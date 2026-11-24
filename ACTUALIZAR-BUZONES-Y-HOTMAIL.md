# SURCOSSTREAMING 1.5 — buzones multiproveedor y Hotmail por código

## Proyecto completo

El ZIP contiene todo el proyecto, listo para descomprimir y subir al repositorio de esta página. Se conserva la base que teníamos guardada, el diseño público, las reglas originales, los datos incluidos y el administrador. No contiene los cambios que hayas hecho posteriormente en tu GitHub.

La página conserva su consulta directa, sin crear tabla de usuarios ni login de clientes. El panel conserva su administrador y añade únicamente las opciones de buzones.

## Actualizar una instalación en funcionamiento

Primero descarga un respaldo de tu repositorio actual. Conserva de ese respaldo tus archivos actuales `script.js`, `mailboxes.json`, `lib/mail-rules.js` y tus credenciales de administrador. En los proyectos con usuarios, el administrador sigue en functions/api/updateusers.js; en los sencillos sigue en lib/admin-config.js. No cambies esos datos al actualizar. Conserva también tus imágenes/estilos si los personalizaste.

Mantén las carpetas configuradas en cada buzón, por ejemplo Newsletter de Zoho si lo utilizas. El nuevo mailboxes.json no debe sustituir los buzones que ya tienes guardados en GitHub.

Para actualizar únicamente el código necesario, copia estos archivos del ZIP respetando las carpetas:

- `lib/mail-providers.js`
- `lib/mailbox-vault.js`
- `lib/imap-protocol.js`
- `lib/mailbox-handler.js`
- `lib/microsoft-oauth.js`
- `lib/microsoft-handler.js`
- `lib/microsoft-public-client.js`
- `lib/microsoft-device-handler.js`
- `functions/api/microsoft/start.js`
- `functions/api/microsoft/callback.js`
- `functions/api/microsoft/device.js`
- `mailbox-admin.js`
- `microsoft-device-admin.js`
- `lib/mailbox-store.js`
- `lib/imap-mail.js`
- `lib/consult-handler.js`
- `admin.html`
- `build.mjs`
- `_headers`
- `package.json`
- `package-lock.json`

El admin.html incluido ya incorpora el buscador donde hay usuarios; no vuelvas a pegar el bloque anterior de búsqueda porque saldría duplicado. Si tu admin.html tiene personalizaciones propias adicionales, intégralas con la sección de buzones del archivo nuevo.

No subas node_modules, dist, .env ni .dev.vars. Mantén el build `npm run build` y salida `dist`. Espera el despliegue de Cloudflare y recarga con Ctrl + F5.

## Variables: las cinco actuales para el modo de código

GITHUB_TOKEN, GITHUB_REPO, GITHUB_FILE_PATH, GITHUB_BRANCH y MAILBOX_ENCRYPTION_KEY. Conserva sus valores actuales: GITHUB_REPO debe apuntar al repositorio real de ESTA página. Conserva exactamente MAILBOX_ENCRYPTION_KEY para poder descifrar los buzones existentes.

No necesitas crear MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET ni MICROSOFT_REDIRECT_URI para probar el modo de cliente público. Si las tienes para tu aplicación propia, se conservan como alternativa y solo se usan en esa modalidad.

## Agregar un Hotmail

1. Entra en Administrar con las credenciales de este proyecto.
2. Cancela una edición anterior o pulsa Editar si quieres reconectar un Hotmail ya registrado.
3. Selecciona Hotmail / Outlook / Microsoft 365 e introduce el correo exacto.
4. Elige Prueba sin secreto — cliente público Thunderbird y marca su confirmación.
5. Pulsa Conectar con código de Microsoft.
6. Abre el enlace oficial que muestra el panel, escribe el código y autoriza ese mismo correo. Mantén abierta tu página mientras comprueba el acceso.
7. Se guarda solo después de autorizar y verificar IMAP. Prueba la conexión y una consulta real reciente.

El modo usa un identificador público de Mozilla Thunderbird: la pantalla de Microsoft puede mostrar ese nombre. Esta página no es Thunderbird ni está afiliada a Mozilla. Se mantiene como modalidad experimental sujeta a las condiciones del titular y a las políticas de Microsoft, que pueden cambiar o restringirla. No elimina la dependencia de OAuth ni garantiza acceso permanente. Los tokens se guardan cifrados en GitHub y se renuevan cuando hace falta; una autorización revocada requiere reconectar.

La guía PRUEBA-HOTMAIL-SIN-SECRETO.md explica el flujo y sus límites con más detalle.

## Otros buzones

Se añaden Gmail, Microsoft, Zoho, Yahoo, iCloud, AOL, GMX y Otro/IMAP personalizado. Gmail conserva el método de correo y clave de aplicación. Los demás proveedores por contraseña necesitan tener IMAP habilitado y permitir su contraseña o clave de aplicación. En Otro configura servidor público, usuario, puerto y SSL/TLS directo o STARTTLS obligatorio. Otros OAuth requieren integraciones propias; no basta con escribir su servidor.

En Zoho el servidor depende del plan y la región. La carpeta debe ser una carpeta real expuesta por IMAP, no necesariamente una vista como Todos los correos. Cada buzón conserva su carpeta independiente.

## Validación y datos

Se conserva el cifrado AES-GCM de los buzones anteriores, el formato de resultados de esta página y sus asuntos, enlaces, destinatarios, ventana temporal y límites propios de mensajes. Los proyectos sencillos mantienen su acceso directo; los que manejan usuarios conservan la validación y las restricciones por usuario.

Las pruebas de cada proyecto incluyen los escenarios anteriores y los nuevos proveedores, TLS/STARTTLS, OAuth propio, código de dispositivo, renovación sin secreto, panel y búsquedas donde corresponden. Se compilan Functions con Wrangler. No se han hecho commits en tu repositorio ni usado tus credenciales reales. El modo por código es el mismo que ya probaste en Streaming Gamaz; debes verificar una conexión y consulta real después del despliegue de cada página.
