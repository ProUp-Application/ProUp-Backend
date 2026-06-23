# ProUp Backend — imagen de producción
FROM node:22-slim

WORKDIR /app

# Prisma necesita openssl en runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Dependencias (incluye dev para compilar TS y generar Prisma)
COPY package*.json ./
RUN npm ci

# Código y build
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# Aplica migraciones y arranca el servidor
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
