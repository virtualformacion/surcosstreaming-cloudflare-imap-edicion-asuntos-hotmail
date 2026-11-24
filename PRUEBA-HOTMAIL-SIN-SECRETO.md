> Para instalar esta actualización en este proyecto, sigue primero ACTUALIZAR-BUZONES-Y-HOTMAIL.md. Esta guía complementaria describe la conexión y la modalidad opcional de aplicación propia.

# SURCOSSTREAMING 1.5 — prueba Hotmail con cliente público

## Qué cambia para ti

Se añade una modalidad experimental de Microsoft mediante código de dispositivo, sin las tres variables MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET y MICROSOFT_REDIRECT_URI. Las cinco variables de GitHub/cifrado existentes siguen siendo necesarias.

Esta modalidad usa, por defecto, el identificador público de **Mozilla Thunderbird** publicado por Mozilla y documentado en proyectos de interoperabilidad. **Esta página no es Thunderbird ni está afiliada a Mozilla.** Es un ensayo técnico para tu propio buzón; no incluye un secreto compartido o filtrado. El identificador público no transfiere la propiedad de la aplicación ni acredita autorización de Mozilla para desplegar un servicio ajeno bajo su identidad. Comprueba las condiciones del titular antes de convertir el ensayo en un servicio para terceros. Microsoft o el titular pueden modificar, restringir o bloquear ese cliente. No es una solución que elimine la dependencia de OAuth o garantice acceso permanente.

La modalidad de aplicación propia que ya existía se conserva, junto con Gmail, Zoho, el resto de proveedores y todas las funciones de usuarios/asuntos.

## Actualizar sin perder tus buzones ni la carpeta Newsletter de Zoho

Descarga una copia de tu repositorio actual. Desde este ZIP actualiza solamente:

1. `admin.html`
2. `mailbox-admin.js`
3. `microsoft-device-admin.js` (nuevo)
4. `build.mjs`
5. `_headers`
6. `lib/microsoft-public-client.js` (nuevo)
7. `lib/microsoft-device-handler.js` (nuevo)
8. `lib/microsoft-oauth.js`
9. `functions/api/microsoft/device.js` (nuevo)
10. `package.json` y `package-lock.json`

El proyecto debe tener ya la versión multiproveedor anterior. Para una instalación anterior a esa versión, instala también sus archivos indicados en ACTUALIZAR-PROVEEDORES.md.

**Conserva los archivos actuales de GitHub `mailboxes.json`, `script.js`, `lib/mail-rules.js` y `functions/api/updateusers.js`.** En especial, conserva el mailboxes.json donde ya guardaste Zoho con su carpeta Newsletter. El ZIP contiene la copia usada como base, no los buzones que añadiste en tu repositorio después de enviarla. Conserva también tus estilos e imágenes actuales. El administrador, los usuarios, los permisos y el buscador se mantienen.

No subas `node_modules`, `dist` ni archivos de secretos. Build sigue siendo `npm run build` y salida `dist`. Espera a que el despliegue termine y recarga con Ctrl + F5.

## Variables para la prueba

Solo las cinco que ya usabas:

- GITHUB_TOKEN
- GITHUB_REPO
- GITHUB_FILE_PATH
- GITHUB_BRANCH
- MAILBOX_ENCRYPTION_KEY (conserva exactamente la actual)

No inventes valores para Microsoft. No hace falta crear MICROSOFT_CLIENT_SECRET ni MICROSOFT_REDIRECT_URI para el modo experimental. Si ya están configuradas para tu aplicación propia, puedes conservarlas: solo se utilizan al elegir ese método.

Opcional avanzado: MICROSOFT_DEVICE_CLIENT_ID permite sustituir el identificador de prueba por uno de cliente público que tengas autorizado, con flujo de dispositivo habilitado. Si no necesitas cambiarlo, no crees esa variable. El preset usa el endpoint `consumers`, destinado a cuentas personales Hotmail/Outlook; las cuentas de empresa pueden necesitar otra configuración o la modalidad de aplicación propia.

## Cómo probar un Hotmail

1. En tu página abre Administrar con tu administrador habitual.
2. Cancela cualquier edición de Zoho para no cambiar ese registro. Para un Hotmail nuevo deja vacío el ID del formulario; si el Hotmail ya existe, pulsa Editar sobre ese registro.
3. Elige Hotmail / Outlook / Microsoft 365.
4. Escribe el correo exacto del buzón Hotmail/Outlook que vas a autorizar y, si quieres, su nombre.
5. En Método de conexión Microsoft elige **Prueba sin secreto — cliente público Thunderbird**.
6. Lee el aviso y marca la confirmación de que vas a probar tu propio buzón usando ese cliente externo.
7. Pulsa **Conectar con código de Microsoft**.
8. En el mismo panel aparecerá un código y el enlace **Abrir Microsoft para autorizar**. Abre ese enlace oficial e introduce el código. No compartas el código ni introduzcas códigos enviados por desconocidos.
9. Inicia sesión en Microsoft con el mismo correo del formulario. Si aparece otra cuenta, cambia a la correcta. La autorización puede identificar al cliente como Mozilla Thunderbird o Mzla Technologies Corporation, no como Streaming Gamaz. Revisa el consentimiento antes de aceptarlo; si el nombre o los permisos no coinciden con lo esperado, cancela.
10. Mantén abierto el administrador de tu página. Comprueba el estado automáticamente, respetando el intervalo de Microsoft. No tienes que copiar tokens ni contraseñas.
11. Solo después de obtener permiso, comprobar el acceso IMAP al buzón indicado y guardarlo en GitHub se mostrará el éxito.
12. Pulsa Probar conexión en el registro y consulta un mensaje real reciente cuyo asunto y destinatario cumplan tus reglas.

Si Microsoft solicita habilitar IMAP, en Outlook.com revisa Configuración > Correo > Reenvío e IMAP. Si exige aprobación, rechaza el cliente, bloquea el código o devuelve un AADSTS, envía únicamente ese error para revisarlo, nunca el código de autorización, refresh token o contraseña. No se garantiza que todas las cuentas o políticas acepten este cliente.

Carpeta vacía mantiene la búsqueda anterior de All/INBOX según lo que exponga el servidor. Newsletter de Zoho sigue siendo una configuración independiente del buzón Zoho. Cada proveedor conserva sus carpetas y tus criterios de consulta.

## Qué se guarda

El código interno de dispositivo permanece cifrado en una cookie HttpOnly, Secure y SameSite=Strict, válida durante la prueba. No se guarda en GitHub ni se entrega al JavaScript. El código corto que debes introducir sí se muestra en tu administrador.

El buzón se guarda únicamente después de autorizarlo y verificar IMAP. Los tokens se guardan cifrados en oauth_encrypted de mailboxes.json, con el identificador y tipo del cliente asociados dentro del cifrado. La renovación usa ese mismo cliente público sin enviar un client_secret, aunque existan variables de la modalidad propia. No se muestran los tokens al listar buzones.

La renovación mantiene el commit con prefijo [CI Skip] para no generar un build de Pages por cada renovación. Se conservan las protecciones contra sobrescribir cambios simultáneos. No hace falta un proceso permanente ni KV/D1. Al vencer un código puedes iniciar otra prueba; Cancelar y Cerrar sesión detienen la comprobación del panel.

## Pruebas realizadas y límites de lo comprobado

- Pruebas automatizadas de usuarios, asuntos, permisos, proveedores, TLS/STARTTLS, MIME/reenvíos y resultados originales.
- Pruebas de código de dispositivo: confirmación explícita, administrador, cookie cifrada, asociación al flujo, vencimiento, cancelación, espera obligatoria y slow_down.
- Pruebas de autorización simulada, verificación IMAP antes de guardar y renovación pública sin secreto, con cifrado y protección de registros.
- Prueba DOM del panel de código y la conservación de los modos anteriores.
- Compilación con Wrangler para Cloudflare Pages.

**Prueba real de inicio:** Microsoft respondió HTTP 200 al endpoint de código de dispositivo con el identificador público y los permisos IMAP/offline_access. El propio handler del proyecto también devolvió 200 y pudo guardar la sesión cifrada de inicio en una cookie de 2541 bytes. No se registró una aplicación propia ni se envió client_secret.

**No se ha completado una autorización real de Hotmail ni una lectura real de correo:** eso requiere iniciar sesión y dar consentimiento con tu cuenta. Tampoco se han escrito commits en tu repositorio. El éxito del inicio no demuestra que Microsoft vaya a permitir completar la conexión de todas las cuentas ni constituye permiso del titular del ID para reutilizarlo en un servicio ajeno.

## Referencias

- Microsoft: https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-device-code
- Publicación del cliente Mozilla: https://support.mozilla.org/en-US/kb/microsoft-oauth-authentication-and-thunderbird-202
- Ejemplo de interoperabilidad: https://github.com/UvA-FNWI/M365-IMAP
