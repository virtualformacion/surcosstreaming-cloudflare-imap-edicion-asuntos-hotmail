> Para instalar esta actualización en este proyecto, sigue primero ACTUALIZAR-BUZONES-Y-HOTMAIL.md. Esta guía complementaria describe la conexión y la modalidad opcional de aplicación propia.

# SURCOSSTREAMING 1.4 — IMAP con varios proveedores

## Qué incluye

El administrador conserva usuarios, correos autorizados, consultas permitidas, asuntos, buzones y buscador. La página conserva la presentación del cuerpo del mensaje o la redirección al enlace. No cambia la selección de asuntos, destinatarios, reenvíos ni los límites originales de búsqueda.

Ahora puedes elegir Detectar por el correo, Gmail, Hotmail/Outlook/Microsoft 365, Zoho, Yahoo, iCloud, AOL, GMX u Otro/IMAP personalizado.

- Gmail: correo y clave de aplicación, igual que antes. Los registros anteriores sin proveedor se siguen interpretando como Gmail, incluso si usan un dominio propio de Google Workspace.
- Microsoft: correo y botón Conectar con Microsoft. Requiere configurar la aplicación descrita más abajo. No utiliza la contraseña del correo en el formulario.
- Otros proveedores: correo, contraseña o clave de aplicación admitida por el proveedor y, cuando haga falta, servidor y usuario de conexión. Las claves que no son de Google se conservan exactamente, incluidos espacios.
- Personalizado: servidor IMAP público, puerto y usuario. Admite SSL/TLS directo, habitualmente 993, y STARTTLS obligatorio, habitualmente 143. Las credenciales se envían después de establecer TLS. No hay modo sin cifrar.

El modo personalizado admite servidores compatibles con IMAP LOGIN por contraseña. No implementa automáticamente el OAuth de cualquier proveedor: Microsoft tiene su integración específica; los demás deben admitir una contraseña/clave de aplicación o necesitarán otra integración. La disponibilidad de IMAP, las contraseñas de aplicación, el plan y las restricciones de red dependen del proveedor.

## 1. Actualizar el proyecto existente

Descarga primero una copia de tu repositorio actual. Actualiza SOLO estos archivos, con sus carpetas:

1. `admin.html`
2. `mailbox-admin.js`
3. `lib/mail-providers.js` (nuevo)
4. `lib/imap-protocol.js`
5. `lib/imap-mail.js`
6. `lib/mailbox-vault.js`
7. `lib/mailbox-handler.js`
8. `lib/mailbox-store.js`
9. `lib/consult-handler.js`
10. `lib/microsoft-oauth.js` (nuevo)
11. `lib/microsoft-handler.js` (nuevo)
12. `functions/api/microsoft/start.js` (nuevo)
13. `functions/api/microsoft/callback.js` (nuevo)
14. `package.json` y `package-lock.json` (versión 1.4)

Puedes copiar también las pruebas y documentos nuevos. Build y directorio de salida siguen siendo `npm run build` y `dist`. No hacen falta D1, KV ni nuevas dependencias para OAuth.

**Conserva tu `script.js`, `mailboxes.json`, `lib/mail-rules.js`, `functions/api/updateusers.js`, imágenes y estilos actuales.** No reemplaces datos recientes de GitHub por copias del ZIP. El ZIP conserva exactamente los datos que adjuntaste, no los cambios posteriores de tu repositorio. El administrador y su vencimiento no se modifican. Tu buscador de usuarios permanece dentro de admin.html.

No subas `node_modules`, `dist`, `.env`, `.dev.vars` ni secretos. Espera que Cloudflare termine el despliegue y recarga con Ctrl + F5.

## 2. Variables de Cloudflare

Las cinco existentes permanecen:

| Variable | Uso |
|---|---|
| `GITHUB_TOKEN` | Secreto; Contents: Read and write sobre este repositorio |
| `GITHUB_REPO` | Propietario/repositorio real de esta página |
| `GITHUB_FILE_PATH` | `script.js` |
| `GITHUB_BRANCH` | Tu rama, normalmente `main` |
| `MAILBOX_ENCRYPTION_KEY` | Conserva exactamente el valor actual |

**Solo para Hotmail/Outlook/Microsoft 365**, agrega estas tres:

| Variable | Valor |
|---|---|
| `MICROSOFT_CLIENT_ID` | Application (client) ID del registro de Microsoft |
| `MICROSOFT_CLIENT_SECRET` | Secreto: VALUE del secreto de cliente, no su identificador |
| `MICROSOFT_REDIRECT_URI` | `https://TU-DOMINIO/api/microsoft/callback` |

No coloques esos valores dentro del código ni en GitHub. No hace falta crear otra MAILBOX_ENCRYPTION_KEY: la actual cifra contraseñas y autorizaciones, usando contextos separados.

Sin las tres variables Microsoft, Gmail y los demás proveedores por contraseña siguen funcionando. El botón Microsoft indicará qué variable falta.

## 3. Configurar Microsoft una vez

1. Abre https://entra.microsoft.com/ con una cuenta que pueda registrar aplicaciones. Ve a Microsoft Entra ID > App registrations > New registration (Registro de aplicaciones > Nuevo registro).
2. Nombre: por ejemplo, SURCOSSTREAMING IMAP.
3. Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**. Esta opción permite Hotmail/Outlook personales y cuentas de Microsoft 365, cuando sus administradores lo permitan.
4. Redirect URI: elige plataforma **Web**, NO Single-page application (SPA). Pega exactamente `https://TU-DOMINIO/api/microsoft/callback` y registra la aplicación.
5. Copia Application (client) ID para MICROSOFT_CLIENT_ID.
6. En Certificates & secrets > Client secrets > New client secret, crea uno. Copia su **Value** para MICROSOFT_CLIENT_SECRET. Guarda su vencimiento: tendrás que renovarlo y actualizar el secreto de Cloudflare cuando caduque.
7. En API permissions > Add a permission, busca **Office 365 Exchange Online** (puede estar en APIs my organization uses). Elige **Delegated permissions** y agrega **IMAP.AccessAsUser.All**. No uses Microsoft Graph Mail.Read como sustituto: esta aplicación lee IMAP.
8. La aplicación solicita además `offline_access` al conectar para poder renovar el acceso. No activa acceso SMTP ni envía correo. Si tu organización exige consentimiento de administrador, su administrador debe aprobarlo.
9. Guarda las tres variables en el entorno Production de Cloudflare y vuelve a desplegar.
10. En Outlook.com habilita IMAP: Configuración > Correo > Reenvío e IMAP > Permitir que los dispositivos y aplicaciones usen IMAP. En Microsoft 365 la disponibilidad puede depender del administrador y sus políticas.

**Usa siempre el dominio configurado en MICROSOFT_REDIRECT_URI para abrir el panel.** Si configuraste un dominio propio, no inicies la conexión desde otra URL de preview o pages.dev. La URL registrada en Microsoft, la variable y el dominio del panel deben coincidir.

Registrar la aplicación es un requisito de Microsoft. Si tu cuenta no permite registros, necesitarás un tenant/cuenta con ese permiso o ayuda de su administrador; el ZIP no crea ese registro por sí mismo.

## 4. Conectar un buzón Microsoft

1. Entra en tu administrador habitual.
2. Elige Hotmail / Outlook / Microsoft 365, o escribe un dominio conocido con Detectar por el correo.
3. Introduce nombre y **correo exacto del buzón que vas a autorizar**. Si tienes otra sesión Microsoft abierta, selecciona la cuenta correcta al conectar.
4. Carpeta vacía usa una carpeta All si el servidor la anuncia; si no, INBOX. Puedes indicar otra carpeta exacta.
5. Pulsa Conectar con Microsoft. Se abre una ventana: inicia sesión y acepta los permisos.
6. El sistema comprueba IMAP antes de guardar. El token debe permitir abrir el buzón indicado; no se aceptan credenciales de una cuenta diferente por el mero hecho de completar el login.
7. La ventana se cierra al completar y el panel actualiza la lista. Si el navegador bloqueó la ventana, la autorización puede abrirse en la misma pestaña; al volver tendrás que iniciar sesión otra vez en el administrador.
8. Usa Probar conexión para verificarlo. Puedes editar nombre/carpeta, activar, desactivar y eliminar. Para renovar una autorización revocada, edita el registro existente y pulsa Conectar con Microsoft.

Cambiar el correo/proveedor de un buzón Microsoft requiere volver a autorizarlo. Para un cambio de servidor/usuario/cifrado de un buzón por contraseña debes introducir de nuevo la contraseña. Dejarla vacía al editar solo datos conserva la que tenía.

Los tokens de acceso y renovación se guardan **cifrados** dentro del registro `oauth_encrypted` de `mailboxes.json`. El navegador no recibe esos tokens al listar. No tienes que pegar refresh tokens ni contraseñas de Hotmail manualmente.

La renovación se realiza cuando hay una consulta/prueba y hace falta renovar, no mediante un proceso permanente. Se conserva el refresh token más reciente mediante un commit de GitHub. Esos commits de renovación empiezan por **[CI Skip]** para que Cloudflare Pages no genere una compilación por cada renovación. Los cambios de configuración, usuarios y asuntos mantienen sus commits normales. Siguen aplicándose las cuotas de GitHub y Cloudflare.

El acceso puede caducar o ser revocado por Microsoft, por cambio de políticas, revocación de consentimiento o vencimiento del secreto de la aplicación. En esos casos actualiza la configuración o vuelve a conectar. Eliminar el buzón del panel no borra correos ni revoca por sí mismo el consentimiento en Microsoft.

## 5. Zoho, Yahoo, iCloud, AOL, GMX y otros

1. Habilita IMAP en el proveedor y comprueba que tu plan lo permite.
2. Elige proveedor o detección automática por correo.
3. Verifica servidor, puerto y cifrado en la configuración oficial de tu cuenta. Zoho cambia de servidor por tipo de cuenta y centro de datos: `imap.zoho.com`, `imappro.zoho.com` o la variante regional correspondiente. No asumas que todos los dominios propios usan Gmail o Microsoft; elige su proveedor explícitamente.
4. Introduce correo, clave de aplicación/contraseña admitida y usuario de conexión si no coincide con el correo completo. iCloud puede requerir el nombre de usuario indicado por Apple.
5. Carpeta vacía usa All cuando esté disponible o INBOX. Puedes establecer una carpeta específica; no se recorren automáticamente todas las carpetas de todos los proveedores.
6. Guarda y prueba la conexión. Las conexiones de buzones activos se verifican antes de guardar.

En **Otro / IMAP personalizado** escribe solo el hostname, sin `https://`, rutas ni `:puerto`. El puerto va en su campo. El servidor debe ser accesible públicamente desde Cloudflare y tener certificado TLS válido. Cloudflare bloquea conexiones a direcciones privadas/localhost y a sus rangos de IP de proxy; un servidor de correo propio debe permitir acceso TCP directo. No se omite la validación del certificado.

Para añadir otro proveedor fijo compatible con contraseña, edita `lib/mail-providers.js` siguiendo el formato de PROVIDERS: nombre, host, puerto, `auth:'password'` y dominios. El selector se carga desde esa lista. Si el proveedor exige OAuth o un protocolo especial, añadir solo el servidor no implementa esa autenticación.

## 6. Lo que se conserva y comprobación final

Este proyecto conserva su consulta directa sin gestión de usuarios; el administrador; los asuntos y enlaces; el buscador y el diseño público. Se mantienen la ventana de diez minutos, la prioridad de código frente a enlace, el tratamiento de reenvíos y alias y los límites originales de este proyecto. Usar otro proveedor no hace que sus alias ni sus reglas de entrega sean idénticos a Gmail: el mensaje recibido debe conservar el destinatario buscado.

Después de desplegar:

1. Prueba un Gmail que ya utilizabas y verifica un cuerpo de mensaje y un enlace.
2. Comprueba un usuario con asuntos bloqueados y su correo autorizado.
3. Conecta Microsoft, prueba INBOX y un mensaje real que coincida con tus asuntos.
4. Añade tu otro proveedor con su configuración oficial y prueba un mensaje real.
5. Verifica editar, activar/desactivar y eliminar buzones, además del buscador de usuarios.

Las pruebas incluidas usan GitHub, Microsoft y sockets IMAP simulados, cubren OAuth/PKCE, cookies, cifrado, renovación, TLS/STARTTLS, UI y las funciones anteriores. No se han usado tus credenciales reales, no se ha registrado una aplicación Microsoft por ti ni se han hecho commits en tu repositorio desde aquí. La comprobación real se completa después de configurar y desplegar.

## Fuentes oficiales

- OAuth IMAP Microsoft: https://learn.microsoft.com/en-us/exchange/client-developer/legacy-protocols/how-to-authenticate-an-imap-pop-smtp-application-by-using-oauth
- Authorization Code / PKCE: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow
- Configuración Outlook: https://support.microsoft.com/es-es/outlook/pop-imap-and-smtp-settings-for-outlook-com
- Zoho: https://www.zoho.com/mail/help/imap-access.html
- Yahoo: https://help.yahoo.com/kb/imap-settings-sln4075.html
- iCloud: https://support.apple.com/es-es/102525
- AOL: https://help.aol.com/articles/how-do-i-use-other-email-applications-to-send-and-receive-my-aol-mail
- GMX: https://support.gmx.com/pop-imap/imap/server.html
- TCP / STARTTLS Cloudflare: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
- Omitir builds con prefijo de commit: https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/
