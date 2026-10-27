# Blau Content: instrucciones para Claude

Aplicación de gestión de contenidos de Agencia Blau para el equipo y sus clientes. Producción: https://app.agenciablau.com. Repositorio: `Agenciablau/blau-content`, rama `main`.

El prototipo de `contento-calendario.elatedgiant9.chatgpt.site` es un proyecto separado y antiguo. No lo uses como fuente ni copies su código o su comportamiento.

## Reglas de trabajo

- No trabajes sobre `main`. Crea una rama, abre un pull request y espera la revisión.
- Un push o merge a `main` activa el despliegue automático de Cloudflare (`npm run build` + `npm run deploy`, que aplica migraciones D1). No integres, no despliegues y no ejecutes `npm run deploy` ni `wrangler d1 migrations apply --remote` sin autorización expresa.
- No modifiques datos de producción para hacer pruebas.
- No cambies permisos, roles, credenciales, recursos de Cloudflare (D1, R2, Access, dominios, variables) ni conexiones externas (Buffer, Google) sin una petición expresa.
- No pidas ni guardes secretos. Las variables (`ADMIN_EMAIL`, `TEAM_DOMAIN`, `POLICY_AUD`, `APP_ORIGIN`, `R2_PUBLIC_ORIGIN`, `BUFFER_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `BREVO_API_KEY`, `EMAIL_FROM`) viven en Cloudflare; `keep_vars` las conserva. No subas `.dev.vars`, `.env*`, copias de seguridad ni archivos de clientes.
- Haz cambios acotados y conserva las funciones existentes. Interfaz siempre en español, con la identidad visual Blau (`src/styles.css`, `public/blau-content-logo.png`).
- Si se pide una propuesta visual antes de implementar, entrega primero una maqueta sin tocar la aplicación.

## Arquitectura

- `src/`: React 19 + TypeScript + Vite. `Planner.tsx` contiene casi toda la interfaz (vistas, barra lateral, modales). Componentes auxiliares: `ClientProfile*`, `MonthlyCommitments`, `Buffer*`, `CreativePreview`, `CarouselLinksEditor`, `DeleteClientConfirmation`.
- `worker/`: Cloudflare Worker que sirve `dist/` y la API.
  - `index.ts`: cabeceras de seguridad, comprobación de origen, autenticación y enrutado. Cron cada minuto → `processStoryQueue` y `sendDigests` (resúmenes por correo con Brevo a las 10:00 y 22:00 de Madrid, `email-digest.ts`).
  - `auth.ts`: verificación del JWT de Cloudflare Access (`Cf-Access-Jwt-Assertion`, RS256, emisor, audiencia, caducidad).
  - `workspace.ts`: `GET/POST /api/workspace` (acciones `init`, `import`, `client`, `deleteClient`, `member`, `removeMember`, `post`, `review`, `comment`, `delete`; `?export=1`, `?preview=<cliente>`). Aquí están los permisos y el aislamiento por cliente.
  - `integrations.ts`, `buffer-api.ts`, `drive-api.ts`: `/api/integrations/*`, Buffer, OAuth de Google Drive (solo lectura) y copias en R2.
  - `import-backup.ts`: importación JSON (versión 1) en espacio vacío, atómica, máximo 4.000 registros.
- `shared/`: lógica común de cliente y Worker (`client-profile.ts`, `monthly-commitments.ts`, `buffer-scheduling.ts`, `material-links.ts`).
- `migrations/`: SQL de D1, numerado. Crea siempre una migración nueva; nunca edites una ya aplicada.
- `scripts/check-*.mjs`: pruebas con SQLite de Node y servicios simulados.

## Modelo de permisos (no romper)

- Roles: `owner` (administrador = `ADMIN_EMAIL`/propietario del espacio), `team`, `client`, `collaborator`, guardados en `members`.
- `client` y `collaborator` solo ven su marca. `client` no ve Idea ni Borrador.
- Clientes y colaboradores solo ven comentarios y revisiones posteriores a `posts.client_changed_at`.
- `profile.drive_folder_url` se elimina de la respuesta para quien no sea `owner`; solo `owner` lo edita.
- Solo `owner` cambia compromisos mensuales, gestiona accesos, exporta, importa, elimina clientes y reasigna publicaciones.
- `collaborator` crea, edita y envía a revisión en su marca, y comenta; no aprueba, no solicita cambios, no elimina.
- Toda comprobación de permisos se hace en el Worker. La interfaz solo oculta.

## Comportamientos que deben mantenerse

- Selector global de cliente (solo equipo y administrador) en la barra lateral, guardado en `localStorage` con la clave `blau:selected-client`. Afecta a vistas, contadores y compromisos.
- Concurrencia optimista: `updated_at` es una versión (`ISO:uuid`); las escrituras comparan la versión y devuelven 409 si cambió.
- Reasignación: solo `owner`, publicación no publicada, cliente destino activo, sin ningún registro en `buffer_jobs` (cualquier estado). Pasa a Borrador (Idea sigue como Idea) y fija `client_changed_at`.
- Revisión: solo desde «En revisión». Bloque con «Solicitar cambios» (requiere «Cambios necesarios») y «Aprobar». La conversación usa su propio campo y «Enviar comentario»; comentar no cambia el estado. Los dos campos son independientes.
- Solo la aprobación real de un cliente en una Historia de Instagram encola un envío en Buffer.
- Contador de compromisos: cuenta por fecha del mes todas las publicaciones con fecha (cualquier estado), sin depender de los filtros visuales. Feed = Reel, Carrusel e Imagen de Instagram; Historias aparte; el exceso de un cliente no compensa a otro.
- Las copias de seguridad deben conservar `client_changed_at`, roles y resolución de comentarios. Si añades columnas, actualiza exportación, `import-backup.ts` y las pruebas.

## Validación

Antes de proponer un cambio, ejecuta y comunica el resultado:

```sh
npm ci            # si faltan dependencias (Node >= 22.13)
npm test
npm run build
npm run check:worker
```

Añade casos en `scripts/check-*.mjs` cuando cambies permisos, estados, reasignaciones, copias o integraciones. Indica con precisión qué se ha comprobado y qué no: una compilación correcta no demuestra que la interfaz ni el despliegue funcionen, y no hay pruebas de navegador.

## Estilo de código

El código es compacto (líneas largas, pocos comentarios, nombres cortos). Sigue el estilo del archivo que edites y evita reformatearlo entero: diffs grandes dificultan la revisión.
