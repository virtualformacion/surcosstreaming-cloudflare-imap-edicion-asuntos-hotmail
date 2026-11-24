import {mkdir,rm,copyFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','admin.html','admin-login.js','mailbox-admin.js','microsoft-device-admin.js','subjects-admin.js','script.js','styles.css','logo.jpg','fondo.jpg','_headers','_routes.json'])await copyFile(file,`dist/${file}`);
console.log('Archivos públicos preparados en dist.');
