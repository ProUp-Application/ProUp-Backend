# Despliegue del backend de ProUp

El backend está listo para desplegarse con el `Dockerfile` incluido. Recomendado: **Railway** (plan gratuito, sin tarjeta para empezar). Alternativas: Render, Fly.io.

## Opción A — Railway (recomendada)

1. Crea una cuenta en [railway.app](https://railway.app) e inicia sesión con GitHub.
2. **New Project → Deploy from GitHub repo →** elige `ProUp-Application/ProUp-Backend` (rama `main`, tras fusionar el PR).
3. **Add a service → Database → PostgreSQL.** Railway crea la base y expone la variable **`DATABASE_URL`** automáticamente.
4. En el servicio del backend, ve a **Variables** y agrega:
   | Variable | Valor |
   |---|---|
   | `JWT_ACCESS_SECRET` | (una cadena larga y secreta) |
   | `JWT_REFRESH_SECRET` | (otra cadena larga y secreta) |
   | `LLM_PROVIDER` | `groq` |
   | `GROQ_API_KEY` | (tu API key de Groq) |
   | `GROQ_MODEL` | `llama-3.3-70b-versatile` |

   > `DATABASE_URL` y `PORT` los inyecta Railway automáticamente. **No subas la API key al repo** (ya está en `.gitignore`); se configura aquí.
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
