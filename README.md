# Blau Content

Planificación de contenidos, calendarios por cliente y aprobación de publicaciones. Interfaz en español con identidad Blau. Esta versión se ejecuta en tu propia cuenta de Cloudflare y no requiere una cuenta de ChatGPT.

## Arquitectura

- React y Vite para la interfaz.
- Un Cloudflare Worker sirve la interfaz y la API en el mismo dominio.
- Cloudflare D1 guarda clientes, accesos, publicaciones, conversaciones e historial de revisiones.
- Cloudflare Access verifica el correo mediante un código de acceso u otro proveedor configurado.
- El material creativo se mantiene en enlaces externos. No hay almacenamiento R2 ni publicación automática en redes.

## 1. Crear la base de datos

En Cloudflare, a nivel de cuenta: **Almacenamiento y bases de datos → D1 → Crear base de datos**.

Nombre: `blau-content-db`. La configuración ya contiene su identificador `905b8e7d-edd9-46c6-94f5-97e71a187eba`. Si despliegas en otra cuenta, reemplaza este identificador en `wrangler.jsonc` o usa la variable de compilación `CLOUDFLARE_D1_ID`.

## 2. Conectar GitHub

En **Cómputo → Workers y Pages → Crear aplicación → Conectar GitHub**, selecciona `Agenciablau/blau-content` y la rama `main`. Elige una aplicación **Worker**, no un proyecto Pages.

| Campo | Valor |
|---|---|
| Nombre del Worker | `blau-content` |
| Directorio raíz | `/` o vacío |
| Comando de compilación | `npm run build` |
| Comando de despliegue | `npm run deploy` |
| Base D1 | `blau-content-db`, ya conectada en `wrangler.jsonc` |
| Node.js | 22.13 o superior |

El comando de despliegue conecta la base y aplica las migraciones antes de publicar. Su token de compilación necesita permisos **Workers Scripts: Edit** y **D1: Edit** para esa cuenta. Si el token generado por el asistente no incluye D1, configura un token con ambos permisos en los ajustes de Builds. Nunca guardes el token en GitHub ni lo compartas en un mensaje.

Los despliegues de ramas de prueba deben permanecer desactivados hasta tener una base y un acceso separados para pruebas. `workers.dev` y las URL de preview están desactivados en la configuración; el acceso público se hará por el dominio personalizado.

## 3. Añadir el subdominio

En el Worker publicado, abre **Domains** (o **Settings → Domains & Routes**) y añade el dominio personalizado `app.agenciablau.com`. Cloudflare crea el DNS y el certificado HTTPS. La zona `agenciablau.com` debe estar activa.

## 4. Configurar el acceso por correo

En **Zero Trust / Cloudflare One → Access → Applications**, crea una aplicación **Self-hosted** para `app.agenciablau.com`, cubriendo todas las rutas, sin reglas Bypass.

Configura **One-time PIN** como método de inicio de sesión y una política **Allow → Include → Login Methods → One-time PIN** para esta aplicación. Retira la lista de correos de esa política y no utilices Bypass. Cloudflare verifica la identidad de cualquier correo, pero Blau Content autoriza cada petición según los correos y roles guardados en D1. Los correos sin registrar reciben 403 y no pueden crear el espacio ni consultar o modificar contenidos.

Después de esta configuración inicial, las altas y revocaciones se hacen únicamente en **Accesos** de Blau Content: añade el correo, selecciona Cliente o Equipo y asigna su marca. Comparte el enlace de la app. No es necesario modificar Cloudflare para cada usuario y no se envían invitaciones automáticas. Esta política debe estar vinculada únicamente a la aplicación de Blau Content, ya que otras aplicaciones necesitan su propio control de autorización.

En los detalles de la aplicación Access, copia su **Application Audience (AUD)**. Copia también tu dominio de equipo, de la forma `https://tu-equipo.cloudflareaccess.com`.

En el Worker, añade estas variables de ejecución en **Settings → Variables and Secrets** y guarda/publica la configuración:

| Variable | Valor |
|---|---|
| `ADMIN_EMAIL` | Tu correo de administrador, el que utilizarás para crear el espacio |
| `TEAM_DOMAIN` | `https://tu-equipo.cloudflareaccess.com` |
| `POLICY_AUD` | AUD de la aplicación Access |
| `APP_ORIGIN` | `https://app.agenciablau.com` |

Los valores no se incluyen en este repositorio. Las variables configuradas desde el panel se conservan en posteriores despliegues mediante `keep_vars`.

La aplicación rechaza accesos si falta la configuración. Valida la firma del JWT, emisor, audiencia y caducidad; no confía en cabeceras de correo sin verificar. Solo `ADMIN_EMAIL` puede crear el espacio inicial. El cierre de sesión usa el endpoint oficial de Cloudflare Access.

## 5. Crear el espacio y conservar los datos del prototipo

Entra en `https://app.agenciablau.com`, verifica tu correo y pulsa **Crear mi espacio**.

Para conservar los datos del prototipo de ChatGPT:

1. En el prototipo, abre **Accesos → Exportar copia de datos** como administrador.
2. En la nueva app, antes de añadir ningún cliente o publicación, abre **Accesos → Importar copia**.
3. Selecciona el JSON exportado. La importación solo funciona en un espacio vacío y conserva los ID, fechas, conversaciones e historial existente.
4. El administrador de la nueva app será el correo configurado en Cloudflare; la identidad antigua no se importa como propietario.

La importación admite hasta 4.000 registros en una operación. Las referencias y el formato se validan y la escritura es atómica. Los usuarios importados reciben los permisos registrados en la copia y pueden verificar su correo mediante Cloudflare Access. Los archivos enlazados no se copian; revisa sus permisos. Las aprobaciones anteriores a la incorporación del historial no tienen un registro retroactivo.

## Desarrollo y comprobaciones

```sh
npm ci
npm test
npm run build
npm run check:worker
```

`npm run dev` sirve la interfaz, pero necesita una API autenticada para funcionar. `npm run dev:worker` ejecuta el Worker sobre los archivos compilados; necesita una base D1 local migrada y la configuración de Access. No existe un modo de autenticación falsa para producción.

Las pruebas verifican aislamiento de clientes, permisos, control de versiones, revisiones, registro publicado inmutable, importación y validación de JWT. El chequeo de Worker empaqueta el código sin desplegar. La comprobación visual de navegador sigue pendiente.

## Datos y límites

- Los estados Planificado y Publicado se gestionan manualmente.
- Cambiar una pieza aprobada la devuelve a revisión. Una pieza publicada se conserva y se puede copiar como nueva versión.
- Las decisiones guardan persona, rol, fecha y copia del contenido revisado. Los enlaces externos pueden cambiar: utiliza un enlace específico para cada versión del material.
- La exportación es manual; no hay copias automáticas, correos de aviso ni sistema de envío a redes configurados.
- El código puede ser público sin hacer públicos los datos: D1 y Access permanecen en tu cuenta. No subas exportaciones, secretos, `.dev.vars` ni archivos de clientes al repositorio.

## Buffer + Google Drive + R2 (Instagram)

This integration is not connected until the administrator configures the services. Only Instagram stories are sent to Buffer. A real client approval atomically saves the approval and a durable queued job in D1. Reels, carousels, images, staff approvals and administrator preview approvals never trigger scheduling. Existing approvals are not sent retroactively.

### Configure before deploying this version

1. In Cloudflare R2, create a **Standard** bucket named `blau-content-media`. The Wrangler binding is `MEDIA`. Attach the public custom domain `media.agenciablau.com` to this bucket. This domain must serve the media directly without Cloudflare Access login. Only randomly named copies selected for publishing go into this bucket; original Drive files stay unchanged.
2. In the Worker's runtime settings, set `R2_PUBLIC_ORIGIN=https://media.agenciablau.com`.
3. In Buffer, open **Settings → API**, create a personal API key as the organization owner and save it in Cloudflare as the secret `BUFFER_API_KEY`. Never place keys in Git, browser code, or ChatGPT messages.
4. In Google Cloud, enable **Google Drive API**, configure an OAuth consent screen and create an OAuth **Web application** client. Add the exact authorized redirect URI `https://app.agenciablau.com/api/integrations/drive/callback`. Save its ID as `GOOGLE_CLIENT_ID` and its secret as `GOOGLE_CLIENT_SECRET` in Cloudflare runtime settings.
5. Generate a 32-byte encryption key on your own computer with `openssl rand -hex 32` and store it as the secret `INTEGRATION_ENCRYPTION_KEY` in Cloudflare. Keep it stable: changing it requires reconnecting Drive. It encrypts the Drive refresh token at rest in D1.
6. Deploy using the existing `npm run deploy` command. It applies `0003_buffer_integration.sql` before deploying. The R2 bucket must already exist or deployment will fail.
7. As administrator, open **Integraciones**, click **Conectar Google Drive** and authorize the Google account that can read and download the clients' files. The OAuth scope is read-only (`drive.readonly`); the app never edits or deletes Drive originals. If the Google consent app is in Testing, add this Google account as a test user. Testing refresh tokens can expire after seven days. Restricted scopes may require Google verification for external production use; an internal Google Workspace app is an option only within your organization.
8. Click **Verificar y cargar cuentas** and bind each client to its Instagram account in Buffer. A channel cannot belong to two clients. In Buffer, ensure the Instagram connection is valid and its queue is not paused. Automatic publishing must be supported by the connected account and media.

Do not grant access or make all Drive files public just to configure Buffer. Only the exported copies use public, unpredictable R2 URLs. The file URLs must stay available until Buffer publishes. This integration streams files to avoid loading large videos into Worker memory and caps each file at 200 MB; JPG, PNG and MP4 are supported. Buffer performs its own network-specific media validation.

### Sending and maintenance

- A Cron Trigger runs every minute and processes one queued story per invocation, in approval order. Closing the client portal does not stop the queue. Scheduling may take longer with a backlog or large video; use dates sufficiently in the future. Madrid time is converted to UTC, including daylight saving time. Ambiguous/nonexistent changeover times are rejected.
- Drive files are copied to R2, public access is checked, and one Buffer post is created. The database claim prevents concurrent duplicate sends. Posts with an active Buffer job cannot be edited/deleted locally. Cancel the Buffer job first. Clients with active/uncertain Buffer jobs cannot be deleted.
- **Actualizar estado** queries publication status in Buffer on demand. The Cron Trigger dispatches approvals; it does not poll already scheduled posts. Failed configuration, invalid media or rejected submissions preserve the local approval and show an error. No automatic mobile notification fallback is used.
- If Buffer does not acknowledge creation, the job is **Envío sin confirmar** and re-sending is blocked. The administrator can inspect Buffer and link the existing post ID; the app verifies its channel and exact ordered media URLs. It does not automatically retry uncertain mutations.
- After a confirmed rejection or cancellation, **Reintentar envío automático** removes previous copies and queues a new attempt. Active or uncertain submissions cannot be retried. Queued jobs can be cancelled before dispatch; a simultaneous dispatch is protected by an atomic claim.
- **Limpiar copias antiguas** removes copies confirmed published over 30 days ago and pending deletion cleanups. It never removes media for scheduled/uncertain jobs. Cleanup is manual in this version; there is no lifecycle rule that could expire a file before publication.
- Workspace JSON backups currently preserve content and client profiles, but not OAuth credentials, channel mappings, Buffer jobs or R2 binaries. After restoring a backup, reconcile existing Buffer schedules before sending restored content to avoid duplicates. Deleting a client in Blau Content does not delete its Instagram account, original Drive files or already published Instagram posts.

Development validation: `npm test` includes mocked Buffer/Google/R2 integration tests. Live verification still requires the service setup above and an approved test post in a dedicated Instagram account.

Stories accept one JPG, PNG or MP4 Drive file. Reels and carousels keep their existing local review flow and are never copied to R2 or sent to Buffer by this automation. Large videos require live validation against the actual Workers plan and network conditions; R2 storage pricing is separate.

### Comment inbox

The Comentarios tab uses the approvals card grid and existing date/client/platform/format filters. Each new comment stores its authenticated author role; the latest unresolved message assigns the conversation to the other side (client ↔ team). Approval resolves prior comments atomically, while later messages reopen the inbox. Administrator preview messages are stored as team messages. Existing comments have unknown author roles and remain available in conversations, but do not generate potentially incorrect inbox assignments. New backup exports preserve roles and resolution; old backups retain their historical messages without assigning them to an inbox. Deployment applies migration 0004_comment_inbox.sql.
