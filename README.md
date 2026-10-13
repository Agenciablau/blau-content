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

Nombre: `blau-content-db`. Copia el **Database ID / UUID** que aparece en sus detalles. No uses el ID de cuenta ni el ID de zona.

## 2. Conectar GitHub

En **Cómputo → Workers y Pages → Crear aplicación → Conectar GitHub**, selecciona `Agenciablau/blau-content` y la rama `main`. Elige una aplicación **Worker**, no un proyecto Pages.

| Campo | Valor |
|---|---|
| Nombre del Worker | `blau-content` |
| Directorio raíz | `/` o vacío |
| Comando de compilación | `npm run build` |
| Comando de despliegue | `npm run deploy` |
| Variable de compilación `CLOUDFLARE_D1_ID` | UUID real de D1 |
| Node.js | 22.13 o superior |

El comando de despliegue conecta la base y aplica las migraciones antes de publicar. Su token de compilación necesita permisos **Workers Scripts: Edit** y **D1: Edit** para esa cuenta. Si el token generado por el asistente no incluye D1, configura un token con ambos permisos en los ajustes de Builds. Nunca guardes el token en GitHub ni lo compartas en un mensaje.

Los despliegues de ramas de prueba deben permanecer desactivados hasta tener una base y un acceso separados para pruebas. `workers.dev` y las URL de preview están desactivados en la configuración; el acceso público se hará por el dominio personalizado.

## 3. Añadir el subdominio

En el Worker publicado, abre **Domains** (o **Settings → Domains & Routes**) y añade el dominio personalizado `app.agenciablau.com`. Cloudflare crea el DNS y el certificado HTTPS. La zona `agenciablau.com` debe estar activa.

## 4. Configurar el acceso por correo

En **Zero Trust / Cloudflare One → Access → Applications**, crea una aplicación **Self-hosted** para `app.agenciablau.com`, cubriendo todas las rutas, sin reglas Bypass.

Configura **One-time PIN** como método de inicio de sesión y una política **Allow → Emails** con el correo del administrador. Añade los correos del equipo y clientes cuando deban entrar. Registra también sus roles en la pestaña **Accesos** de Blau Content.

En los detalles de la aplicación Access, copia su **Application Audience (AUD)**. Copia también tu dominio de equipo, de la forma `https://tu-equipo.cloudflareaccess.com`.

En el Worker, añade estas variables de ejecución en **Settings → Variables and Secrets** y guarda/publica la configuración:

| Variable | Valor |
|---|---|
| `ADMIN_EMAIL` | Tu correo de administrador, el mismo autorizado en Access |
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

La importación admite hasta 4.000 registros en una operación. Las referencias y el formato se validan y la escritura es atómica. Los usuarios importados deben estar autorizados también en Cloudflare Access. Los archivos enlazados no se copian; revisa sus permisos. Las aprobaciones anteriores a la incorporación del historial no tienen un registro retroactivo.

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
