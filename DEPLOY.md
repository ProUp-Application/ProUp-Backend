# Despliegue del backend de ProUp

El backend está listo para desplegarse con el `Dockerfile` incluido. Recomendado: **Railway** (plan gratuito, sin tarjeta para empezar). Alternativas: Render, Fly.io.

## Opción A — Railway (recomendada)

1. Crea una cuenta en [railway.app](https://railway.app) e inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo →** elige `ProUp-Application/ProUp-Backend` (rama `main`, tras fusionar el PR).
3. **Add a service → Database → PostgreSQL.** Railway crea la base y expone su `DATABASE_URL` **en el servicio de la base de datos** (NO en el del backend).
4. En el servicio del **backend**, ve a **Variables** y agrega:
   | Variable | Valor |
   |---|---|
   | `DATABASE_URL` | **referencia a la BD** → `${{Postgres.DATABASE_URL}}` (usa "Add Reference" y elige la BD; ajusta `Postgres` al nombre real del servicio de base de datos) |
   | `JWT_ACCESS_SECRET` | (una cadena larga y secreta) |
   | `JWT_REFRESH_SECRET` | (otra cadena larga y secreta) |
   | `LLM_PROVIDER` | `groq` |
   | `GROQ_API_KEY` | (tu API key de Groq) |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` |

   > ⚠️ **`DATABASE_URL` NO se comparte sola entre servicios** — debes agregarla en el backend como referencia (paso de arriba). `PORT` sí lo inyecta Railway. **No subas la API key al repo** (ya está en `.gitignore`).

## Troubleshooting

**`Error: Environment variable not found: DATABASE_URL` (el backend crashea en bucle):**
Falta `DATABASE_URL` en el servicio del backend. Solución: agrégala como referencia a la base de datos (paso 4: `${{Postgres.DATABASE_URL}}`) y vuelve a desplegar. Verifica que el nombre del servicio de BD en `${{...}}` coincida con el real.
5. Railway construye con el `Dockerfile`, aplica las migraciones (`prisma migrate deploy`) y arranca el servidor.
6. En **Settings → Networking → Generate Domain** obtienes una URL pública, p. ej. `https://proup-backend-production.up.railway.app`.

## Conectar la app móvil al backend desplegado

Recompila el APK apuntando a esa URL pública (ya no necesitas la IP local ni el firewall):

```bash
cd ProUp-Frontend/proup_mobile
flutter build apk --release --dart-define API_BASE_URL=https://TU-URL.up.railway.app/api/v1
```

Con esto la app funciona **desde cualquier red**, no solo tu WiFi.

## Notas

- **CORS**: actualmente permite todos los orígenes (suficiente para la app móvil). Para producción se puede restringir.
- **Migraciones**: el contenedor ejecuta `prisma migrate deploy` al arrancar, así que el esquema se crea solo.
- **Catálogo**: las 18 profesiones viven en el código (`src/shared/professions.ts`), no requieren seed. El seed de sectores (`npm run db:seed`) es opcional.
