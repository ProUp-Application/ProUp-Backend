# ProUp Backend — imagen de producción
FROM node:22-slim

WORKDIR /app

# Prisma necesita openssl en runtime
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Placeholder de DATABASE_URL SOLO para el build (npm ci/postinstall + prisma generate
# no conectan a la BD, pero exigen que la variable exista). En runtime, Railway inyecta
# el DATABASE_URL real y este valor queda sobrescrito.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Dependencias (incluye dev para compilar TS y generar Prisma)
COPY package*.json ./
RUN npm ci

# Código y build
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# En runtime usa el DATABASE_URL real de Railway: aplica migraciones y arranca
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
