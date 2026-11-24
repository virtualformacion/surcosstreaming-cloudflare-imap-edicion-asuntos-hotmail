# SURCOSSTREAMING 1.2 — Administrar asuntos de códigos desde el panel

## Instalar sobre tu versión IMAP actual

Antes de cambiar archivos, descarga un respaldo de tu repositorio.
Del ZIP nuevo reemplaza o añade SOLAMENTE estos archivos, con sus carpetas:

1. admin.html
2. admin-login.js
3. subjects-admin.js (nuevo)
4. functions/api/subjects.js (nuevo)
5. lib/subjects-store.js (nuevo)
6. lib/subjects-handler.js (nuevo)
7. build.mjs
8. _headers
9. package.json
10. package-lock.json
11. lib/encoding.js

Opcional, para ejecutar las pruebas nuevas: añade tests/subjects.test.mjs y
tests/subjects-ui.test.mjs. Conserva el resto de tus pruebas.

NO sobrescribas los siguientes archivos actuales de GitHub:
- mailboxes.json: contiene tus buzones y claves cifradas.
- lib/mail-rules.js: contiene los asuntos que ya hayas añadido manualmente.
- lib/admin-config.js: conserva tu usuario y contraseña del administrador.
- script.js, index.html, styles.css, logo.jpg y fondo.jpg: no necesitan cambios.

El ZIP completo incluye copias de la base usada para preparar la actualización;
no deben sustituir datos o personalizaciones que hayas cambiado después.
No subas node_modules, dist, .env ni .dev.vars. Sí sube el nuevo package-lock.json.

## Cloudflare

Conserva las mismas cinco variables, especialmente MAILBOX_ENCRYPTION_KEY.
No hay que crear secretos nuevos, volver a introducir buzones ni cambiar el token
si ya tiene permiso Contents: Read and write sobre el mismo repositorio.

La rama sigue siendo la configurada en GITHUB_BRANCH (normalmente main).
El comando sigue siendo npm run build y el directorio de salida dist.
Espera el despliegue del commit con todos los archivos nuevos antes de probar.
Si el panel no muestra la sección, recarga con Ctrl + F5.

## Uso

Entra en /admin.html con tu administrador actual. Debajo de los buzones verás
Asuntos de códigos, con una tabla de los asuntos configurados en GitHub.
Todos los asuntos incluidos en codeSubjects están habilitados tras publicarse.
No se añade un estado activo/inactivo separado ni se cambia la lógica IMAP.

Puedes:
- Agregar un único asunto o varios en el mismo cuadro.
- Poner un asunto por línea, separarlos por comas o punto y coma.
- Pegar una lista con viñetas o numeración sencilla.
- Editar cada asunto con Editar > Guardar, o cancelar la edición.
- Eliminar un asunto con confirmación.
- Actualizar la lista para leer el estado actual de GitHub y la publicación.

Ejemplo por líneas:

    Tu nuevo código de acceso
    Confirma tu inicio de sesión
    Aviso de verificación

Ejemplo separado:

    Tu nuevo código de acceso; Confirma tu inicio de sesión, Aviso de verificación

Si el asunto contiene una coma o punto y coma reales, usa comillas dobles:

    "Tu código, válido por 10 minutos"; "Acceso; confirmación"

Dentro de un campo entre comillas, escribe una comilla doble como dos comillas:

    "Tu código de ""STREAMING"""

También se acepta una lista JSON válida de cadenas. No pegues la declaración
export const completa ni código JavaScript en el cuadro.
Para editar un solo asunto que contiene coma o punto y coma, escribe el texto
normalmente en la fila de edición: ese campo no divide el asunto.

Los duplicados nuevos se omiten sin crear copias. Si todos los asuntos ya existen,
no se crea un commit innecesario. Se conserva el orden de la lista y la coincidencia
sensible a mayúsculas/minúsculas de la búsqueda original.
Se admiten hasta 500 asuntos de códigos, de 1 a 500 caracteres cada uno, sin saltos
de línea dentro de un mismo asunto.

## Qué se modifica en GitHub

La API lee lib/mail-rules.js del repositorio y rama configurados.
Modifica solo el contenido del array exportado codeSubjects, escapando y
acomodando automáticamente cada cadena en su propia línea de JavaScript.
Los comentarios dentro de ese array se sustituyen por el formato nuevo.
El resto del archivo, incluido linkSubjects, se conserva byte por byte.
No se ejecuta eval ni new Function para interpretar las reglas.

Cada cambio crea un commit. El SHA protege las ediciones simultáneas. Si la lista
cambió desde que la abriste, se muestra un conflicto: pulsa Actualizar lista y
repite tu edición; no se sobrescribe silenciosamente el cambio de otra persona.

## Guardado y publicación son dos pasos distintos

El panel lista la versión guardada en GitHub. Las consultas usan los asuntos
compilados en el despliegue de Cloudflare.

Después de agregar/editar/eliminar:
1. El panel guarda el cambio en lib/mail-rules.js mediante un commit.
2. Cloudflare detecta el commit y compila/despliega, si la integración automática
   de la rama está activada.
3. Una vez finalizado ese despliegue, las consultas utilizan la lista nueva.
4. Actualiza la lista o recarga el panel para comprobar que ya no hay pendientes.

La columna Publicación indica si cada asunto de GitHub está en la versión
publicada. El aviso general también detecta eliminaciones pendientes de publicar.
Si un despliegue falla, el asunto puede estar guardado en GitHub pero seguir sin
aplicarse a las consultas. Revisa el estado de Deployments en Cloudflare.
Cada commit puede consumir una compilación del plan.

## Archivos cambiados y comprobaciones

| Archivo | Cambio |
|---|---|
| admin.html | Sección de asuntos debajo de los buzones |
| admin-login.js | Carga la sección al entrar al panel |
| subjects-admin.js | Lista, agregar por lotes, editar, eliminar, avisos y limpieza al salir |
| functions/api/subjects.js | Entrada del endpoint del administrador |
| lib/subjects-handler.js | Autenticación existente, acciones y control de versión |
| lib/subjects-store.js | Lectura, análisis estático del JS, cambio exclusivo del array y commits GitHub |
| build.mjs y _headers | Publica el nuevo JS y evita caché en ese archivo |
| package.json y package-lock.json | Versión 1.2, acorn para leer JS y linkedom para pruebas de interfaz |

La consulta IMAP, buzones, cifrado, credenciales del administrador, reglas de
selección de correo y diseño público no se modificaron.

Pasaron 14 pruebas automatizadas, que comprueban IMAP/buzones y la mejora
sobre formatos de entrada, preservación del archivo, acciones de asuntos, API
GitHub con conflictos y la interfaz del panel con un DOM simulado.
Wrangler compiló correctamente las funciones para Cloudflare.
No se escribieron commits reales en tu cuenta ni se usaron tus credenciales.
Tras desplegar, agrega un asunto de prueba, espera publicación, consulta un correo
que coincida y después edita/elimina ese asunto para confirmar el ciclo completo.

## Archivo adicional de esta actualización

Actualiza también `lib/encoding.js`: incorpora la codificación UTF-8 necesaria para guardar los asuntos. Conserva tu `script.js` actual, tus imágenes, estilos, `lib/admin-config.js`, `lib/mail-rules.js` y `mailboxes.json`. Este proyecto conserva la consulta directa, sin usuarios ni restricciones individuales.
