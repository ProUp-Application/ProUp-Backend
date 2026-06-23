# ProUp — Backend

API del proyecto **ProUp**: app móvil con visión por computador (on-device) y recomendación con IA para la asesoría en imagen personal y habilidades blandas, orientada a mejorar la empleabilidad de jóvenes profesionales en Lima Metropolitana (tesis UPC, Ingeniería de Software).

## Stack

- **Node.js + Express + TypeScript**
- **PostgreSQL** (única base de datos) vía **Prisma ORM**
- **JWT** (access + refresh) + **bcryptjs** para autenticación
- **zod** para validación · **pino** para logs · **helmet/cors** para seguridad
- LLM gratuito (Groq/Llama o Gemini) para chatbot y simulador *(se integra más adelante)*

> Decisiones MVP: una sola base PostgreSQL (el chat usa JSONB en lugar de MongoDB), visión 100 % on-device (no se suben imágenes; el backend solo recibe **scores** y metadatos), y monolito modular (sin microservicios Python).

## Requisitos

- Node.js 20+ (probado con Node 22)
- Docker (para la base de datos de desarrollo) **o** un PostgreSQL propio

## Puesta en marcha (desarrollo)

```bash
# 1. Instalar dependencias
npm install

# 2. Variables de entorno
copy .env.example .env        # PowerShell;  en bash: cp .env.example .env

# 3. Levantar PostgreSQL (Docker, puerto 5433)
npm run db:up

# 4. Crear el esquema en la base de datos
npm run prisma:migrate -- --name init

# 5. Arrancar el servidor en modo desarrollo (hot reload)
npm run dev
```

El servidor queda en `http://localhost:3000`.

> **¿Sin Docker?** Si usas un PostgreSQL local, cambia `DATABASE_URL` en `.env`
> (p. ej. `postgresql://postgres:TU_PASSWORD@localhost:5432/proup`) y crea la base `proup` antes del paso 4.

## Endpoints disponibles

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| GET | `/health` | Estado del servicio + BD | — |
| POST | `/api/v1/auth/register` | Registro (email, password, firstName, lastName, acceptedTerms) | — |
| POST | `/api/v1/auth/login` | Inicio de sesión | — |
| POST | `/api/v1/auth/refresh` | Renueva el access token | — |
| GET | `/api/v1/auth/me` | Datos del usuario autenticado | Bearer |

Formato de error estándar: `{ "error": { "code": "...", "message": "...", "details": ... } }`

## Estructura

```
src/
  config/      env (validado con zod)
  lib/         prisma, logger
  middleware/  errorHandler, authMiddleware (JWT), validate (zod)
  modules/
    health/    health check
    auth/      register / login / refresh / me
  utils/       AppError, asyncHandler, jwt
  app.ts       configuración de Express
  server.ts    arranque HTTP
prisma/
  schema.prisma   modelo de datos completo (DDL)
```

## Scripts

| Script | Acción |
|--------|--------|
| `npm run dev` | Servidor con hot reload (tsx) |
| `npm run build` | Compila TypeScript a `dist/` |
| `npm start` | Ejecuta la build de producción |
| `npm run prisma:migrate` | Crea/aplica migraciones |
| `npm run prisma:studio` | Explorador visual de la BD |
| `npm run db:up` / `db:down` | Levanta/baja PostgreSQL (Docker) |
