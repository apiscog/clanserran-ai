# Clan Serran · Amigo Invisible

Aplicación privada y responsive para organizar el amigo invisible familiar. Usa Next.js (App Router), TypeScript, Better Auth con Google y Microsoft, PostgreSQL en Neon, Drizzle ORM y Tailwind CSS.

## Qué incluye

- Acceso persistente con Google o con cuentas personales de Microsoft (Hotmail, Outlook y Live), y edición del nombre familiar.
- Grupos privados con administrador local, código de seis dígitos y enlace aleatorio de invitación.
- Estados de inscripciones abiertas, lista cerrada y sorteo realizado.
- Preferencias privadas de regalo y exclusión dirigida del destinatario del año anterior.
- Sorteo criptográficamente aleatorizado mediante búsqueda acotada; no se promete uniformidad estadística.
- Resultado privado: cada persona consulta únicamente su destinatario y sus preferencias actuales.
- Autorización en servidor, rate limit persistente para códigos, transacciones, bloqueo por grupo y restricciones de base de datos.
- Interfaz en español, mobile first, accesible por teclado y compatible con `prefers-reduced-motion`.

No hay correos automáticos, login simulado ni datos familiares en el repositorio.

## Requisitos

- Node.js 20.9 o posterior (recomendado Node 22 LTS).
- npm 10 o posterior.
- Un proyecto PostgreSQL de Neon.
- Credenciales OAuth 2.0 de Google de tipo **Aplicación web**.
- Una aplicación de Microsoft Entra con plataforma **Web**, configurada exclusivamente para cuentas personales.

## Puesta en marcha local

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

En PowerShell, copia el entorno con:

```powershell
Copy-Item .env.example .env.local
```

Abre `http://localhost:3000`. Si faltan variables, la portada muestra un estado de configuración en vez de simular el acceso.

## Variables de entorno

| Variable | Visibilidad | Uso |
| --- | --- | --- |
| `DATABASE_URL` | Privada | Cadena PostgreSQL pooled de Neon, con `sslmode=require`. |
| `BETTER_AUTH_SECRET` | Privada | Secreto aleatorio de 32 bytes como mínimo. Genera uno con `openssl rand -base64 32`. |
| `BETTER_AUTH_URL` | URL pública, configurada solo en servidor | Origen canónico sin barra final: `http://localhost:3000` o la URL definitiva. |
| `GOOGLE_CLIENT_ID` | Privada en este proyecto | ID del cliente OAuth de Google. |
| `GOOGLE_CLIENT_SECRET` | Privada | Secreto del cliente OAuth de Google. |
| `MICROSOFT_CLIENT_ID` | Privada en este proyecto | ID de la aplicación de Microsoft Entra. |
| `MICROSOFT_CLIENT_SECRET` | Privada | Valor vigente del secreto de cliente de Microsoft. |
| `TEST_DATABASE_URL` | Privada y opcional | Base PostgreSQL vacía e independiente para las pruebas de integración. Nunca usa `DATABASE_URL` como alternativa. |

No hay variables `NEXT_PUBLIC_*`: el navegador no necesita credenciales ni acceso directo a la base de datos. `.env*` está ignorado salvo `.env.example`.

## Crear y conectar Neon

1. Crea un proyecto en [Neon](https://console.neon.tech/).
2. En **Connect**, elige la rama principal, la base y el rol.
3. Copia la cadena **pooled** y guárdala como `DATABASE_URL` en `.env.local`. Mantén `sslmode=require`.
4. Ejecuta `npm run db:migrate`.

El runtime usa `pg` sobre Node.js porque el sorteo necesita transacciones interactivas y `pg_advisory_xact_lock`. La migración SQL está versionada en `drizzle/`; no uses `drizzle-kit push` en producción.

Comandos de base de datos:

```bash
npm run db:generate  # genera una migración después de cambiar src/db/schema.ts
npm run db:migrate   # aplica las migraciones pendientes
npm run db:studio    # inspección local opcional
```

## Google OAuth y Better Auth

1. En [Google Cloud Console](https://console.cloud.google.com/apis/credentials), configura la pantalla de consentimiento OAuth.
2. Crea un **ID de cliente OAuth → Aplicación web**.
3. Añade como URI de redirección autorizada local:

   ```text
   http://localhost:3000/api/auth/callback/google
   ```

4. Añade para producción, cuando la URL esté confirmada:

   ```text
   https://clanserranai.vercel.app/api/auth/callback/google
   ```

5. Copia el ID y secreto a `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`.
6. Establece `BETTER_AUTH_URL=http://localhost:3000` localmente. En producción debe coincidir exactamente con el origen definitivo.

Better Auth sirve sus rutas en `/api/auth/[...all]`, conserva sesiones 30 días y usa cookies `HttpOnly`, `SameSite=Lax` y `Secure` bajo HTTPS. Las Server Actions de Next.js comprueban el origen de peticiones mutables; Better Auth mantiene además su validación de origen/CSRF habilitada. No añadas dominios de preview a `trustedOrigins` sin una política explícita.

Documentación relevante: [Google en Better Auth](https://better-auth.com/docs/1.6/authentication/google), [integración con Next.js](https://better-auth.com/docs/1.6/integrations/next) y [adaptador Drizzle](https://better-auth.com/docs/adapters/drizzle).

## Microsoft OAuth y cuentas personales

1. En Microsoft Entra, abre la aplicación registrada y confirma que los tipos de cuenta admitidos sean exclusivamente **cuentas personales de Microsoft**.
2. En **Autenticación**, añade una plataforma de tipo **Web**. No uses la configuración de SPA para este flujo de servidor.
3. Registra exactamente el callback local:

   ```text
   http://localhost:3000/api/auth/callback/microsoft
   ```

4. Registra exactamente el callback de producción:

   ```text
   https://clanserranai.vercel.app/api/auth/callback/microsoft
   ```

5. Añade a `.env.local` el ID de aplicación y el **valor** del secreto (no el identificador interno del secreto):

   ```dotenv
   MICROSOFT_CLIENT_ID=tu-id-de-aplicacion
   MICROSOFT_CLIENT_SECRET=tu-valor-de-secreto
   ```

El proveedor integrado de Better Auth se configura con el tenant `consumers`, de modo que admite cuentas personales como Hotmail, Outlook, Live y otras cuentas personales válidas, pero no cuentas de trabajo o centro educativo. Si Microsoft no entrega un correo utilizable, Better Auth rechaza el acceso; no se crea ningún correo ficticio.

Se conserva la política segura predeterminada de vinculación de Better Auth 1.7.7. No se configura `trustedProviders`: una identidad nueva solo se vincula implícitamente a un usuario existente con el mismo correo cuando el proveedor informa que el correo está verificado y el usuario local también lo tiene verificado. Si esas garantías no están presentes, el acceso se rechaza en vez de unir identidades por correo sin más. Tanto Google como Microsoft usan las tablas genéricas `user`, `account`, `session` y `verification` y el mismo ID interno de usuario.

Los secretos de cliente de Microsoft tienen fecha de caducidad. Renuévalo antes de que venza y sustituye únicamente `MICROSOFT_CLIENT_SECRET` en `.env.local` y en Vercel Production; no cambies `MICROSOFT_CLIENT_ID`. Reinicia el servidor local y crea un nuevo despliegue de producción para que cada entorno tome el valor nuevo. Nunca guardes el secreto real en el repositorio.

## Base y pruebas de integración

Las pruebas PostgreSQL crean identidades ficticias directamente como fixtures: no añaden un login alternativo ni prueban el acceso real con Google. Para habilitarlas, crea un **segundo proyecto Neon vacío** destinado solo a pruebas (o una base realmente separada en otro endpoint primario) y guarda su cadena en `TEST_DATABASE_URL` dentro de `.env.local`. Conserva en `DATABASE_URL` la base de la aplicación.

Antes de ejecutar las pruebas, aplica explícitamente las migraciones existentes a esa base. En PowerShell:

```powershell
npm.cmd run db:migrate:test
npm.cmd test
```

`db:migrate:test` y las pruebas cargan `.env.local` con el comportamiento de Next.js y respetan las variables ya presentes en el proceso. Usan exclusivamente `TEST_DATABASE_URL` para escribir. La comprobación de seguridad conecta de forma de solo inspección a ambas URLs y rechaza una misma base aunque cambien el usuario, los parámetros o la variante pooled/directa. Si no puede garantizar el aislamiento, se detiene antes de migrar o crear fixtures.

Sin `TEST_DATABASE_URL`, las pruebas de integración se muestran como omitidas y las pruebas unitarias continúan. El recorrido real cubre los tres participantes, incorporaciones por código e invitación, preferencias, cierre, confirmaciones, permisos, sorteo, privacidad, repetición y bloqueo de nuevas incorporaciones. También se ejecutan sobre la misma base aislada la regresión del estado OAuth del adaptador y la prueba de concurrencia.

## Pruebas y comprobaciones

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

Las pruebas unitarias cubren además reglas del sorteo, exclusiones dirigidas, escenarios imposibles, límite operativo, autorización e invalidación al reabrir inscripciones.

## Despliegue posterior en Vercel

El despliegue no ejecuta migraciones ni pruebas automáticamente: el script de build es únicamente `next build`. Sigue este orden:

1. Aplica las migraciones versionadas a la base de la aplicación desde un equipo controlado, antes del primer despliegue:

   ```powershell
   npm.cmd run db:migrate
   ```

2. En Google Cloud crea o actualiza el cliente OAuth de tipo **Aplicación web**. Cuando conozcas el dominio definitivo, registra exactamente esta URI:

   ```text
   https://DOMINIO-DEFINITIVO/api/auth/callback/google
   ```

3. Importa el repositorio en Vercel, selecciona Next.js y solicita `clanserranai` como nombre del proyecto. El dominio deseado es `clanserranai.vercel.app`, sujeto a disponibilidad. No personalices los comandos: instalación `npm install`, build `npm run build` y directorio de salida detectado por Next.js.
4. En **Settings → Environment Variables**, ámbito **Production**, configura exactamente estas siete variables:

   | Variable | Valor en producción |
   | --- | --- |
   | `DATABASE_URL` | URL pooled de Neon con TLS, por ejemplo con `sslmode=require`. |
   | `BETTER_AUTH_SECRET` | Secreto aleatorio estable de 32 bytes como mínimo. No lo regeneres en cada despliegue. |
   | `BETTER_AUTH_URL` | Origen HTTPS definitivo sin barra final, por ejemplo `https://clanserranai.vercel.app`. |
   | `GOOGLE_CLIENT_ID` | ID del cliente OAuth web de Google. |
   | `GOOGLE_CLIENT_SECRET` | Secreto del mismo cliente OAuth. |
   | `MICROSOFT_CLIENT_ID` | ID de la aplicación Web de Microsoft Entra. |
   | `MICROSOFT_CLIENT_SECRET` | Valor vigente del secreto de cliente de Microsoft. |

   No configures `TEST_DATABASE_URL` en Production: solo se usa al ejecutar voluntariamente las pruebas de integración.

5. En la aplicación de Microsoft Entra, verifica que la plataforma **Web** incluya `https://clanserranai.vercel.app/api/auth/callback/microsoft` y que la aplicación siga limitada a cuentas personales.
6. Despliega. Si el dominio deseado no está disponible, usa la URL definitiva asignada y actualiza **antes de probar el acceso** `BETTER_AUTH_URL` y las URI de callback de ambos proveedores; después vuelve a desplegar.
7. Comprueba la portada, ambos accesos, la persistencia de sesión y un recorrido controlado con datos ficticios. Los previews no están incluidos en `trustedOrigins`; valida OAuth únicamente en el dominio canónico de producción.

Consulta los límites vigentes directamente en [Vercel](https://vercel.com/docs/limits) y [Neon](https://neon.com/pricing) antes de desplegar. No se fijan cuotas en este documento porque pueden cambiar.

## Decisiones de seguridad

- La identidad procede siempre de la sesión validada; ningún formulario acepta un `userId` como identidad del actor.
- Un `GET` de invitación nunca incorpora al usuario: hace falta autenticación y confirmación mediante `POST`.
- El código de seis dígitos solo intenta incorporar a un grupo abierto, no permite consultar miembros ni resultados, y tiene límite persistente por cuenta/IP.
- Las preferencias ajenas no se cargan en la página del grupo. La consulta de resultado filtra directamente por `giverId` de la sesión.
- El administrador no tiene una vista global de asignaciones.
- El sorteo se ejecuta con aislamiento `serializable`, bloqueo transaccional por grupo, claves únicas para emisor/receptor y actualización de estado atómica.
- Si la combinación es imposible o se alcanza el límite operativo, la transacción se revierte completa.
- Los errores del servidor no registran asignaciones, preferencias ni contenido de formularios.

## Estructura principal

```text
src/app/              rutas, páginas y Server Actions
src/components/       formularios interactivos y controles compartidos
src/db/               esquema Drizzle y conexión exclusiva del servidor
src/lib/              auth, sesión, consultas, validación y algoritmo
drizzle/              migraciones SQL versionadas
tests/                pruebas unitarias e integración opcional
```
