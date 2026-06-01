# ProUp-Backend

Backend base para ProUp construido con **Node.js + Express + TypeScript** siguiendo una estructura modular alineada a Clean Architecture.

## Módulo implementado

- **Autenticación**
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/profile` (JWT requerido)

## Estructura principal

- `src/modules/auth` → DTOs, Controllers, Services y Repositories
- `src/shared` → middlewares y manejo de errores centralizado
- `src/config` → validación estricta de variables de entorno

## Seguridad aplicada

- Hash de contraseñas con `bcryptjs`
- JWT para autenticación
- Validación robusta con `zod`
- `helmet`, `cors` y rate limiting en `/api`
- Manejo de errores centralizado

## Variables de entorno

Usa `.env.example` como referencia:

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=change-me-in-production
JWT_EXPIRES_IN=1h
BCRYPT_SALT_ROUNDS=10
```

## Scripts

```bash
npm run dev
npm run lint
npm test
npm run build
npm start
```
