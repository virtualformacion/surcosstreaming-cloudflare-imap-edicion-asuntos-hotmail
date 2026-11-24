(() => {
 const el=id=>document.getElementById(id);let boxes=[],providers={},popup=null;
 const message=text=>{el('mailboxMsg').textContent=text;};
 async function api(action,payload){
  const response=await fetch('/api/mailboxes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...window.getMailboxAdmin(),action,payload})});
  let data;try{data=await response.json();}catch{throw new Error('Respuesta inválida; comprueba el despliegue de Cloudflare');}
  if(!response.ok)throw new Error(data.error||'No se pudo completar la operación');return data;
 }
 function provider(){const selected=el('mailboxProvider').value;if(selected!=='auto')return selected;const domain=el('mailboxEmail').value.trim().toLowerCase().split('@')[1];return Object.keys(providers).find(k=>providers[k].domains.includes(domain))||'custom';}
 function connectionFields(fill=false){
  const key=provider(),config=providers[key]||{},ms=key==='microsoft',gmail=key==='gmail';
  if(fill){el('mailboxHost').value=config.host||'';el('mailboxPort').value=config.port||993;el('mailboxSecurity').value='tls';el('mailboxUsername').value='';}
  el('mailboxHost').disabled=el('mailboxPort').disabled=el('mailboxSecurity').disabled=ms||gmail;
  el('mailboxUsername').disabled=ms;
  el('microsoftAuthOptions').hidden=!ms;
  el('connectMicrosoft').textContent=el('microsoftAuthMode').value==='device'?'Conectar con código de Microsoft':'Conectar con Microsoft';
  el('mailboxPasswordRow').hidden=ms;el('connectMicrosoft').hidden=!ms;
  el('mailboxPasswordLabel').textContent=gmail?'Clave de aplicación Google (16 letras)':'Contraseña / clave de aplicación del proveedor';
  el('mailboxPassword').placeholder='Al editar, vacío conserva la clave actual';
  el('mailboxProviderHelp').textContent=ms?'Microsoft requiere autorización OAuth2. Puedes probar el cliente público sin las variables de Microsoft o elegir tu aplicación propia. Para cambiar solo nombre, carpeta o estado de un buzón conectado, usa Guardar cambios.':key==='custom'?'Introduce el servidor de tu proveedor. Admite IMAP con SSL/TLS o STARTTLS obligatorio y autenticación por contraseña. No admite acceso sin cifrar.':key==='zoho'?'Activa IMAP en Zoho. Revisa el servidor según tu plan y región (por ejemplo, imappro.zoho.com o el de tu centro de datos).':gmail?'Usa la clave de aplicación de Google. Tus buzones Gmail existentes siguen funcionando.':'Activa IMAP en tu proveedor y utiliza su contraseña de aplicación cuando sea necesaria.';
  const old=boxes.find(b=>b.id===el('mailboxId').value);el('saveMailbox').hidden=ms&&(!old||old.provider!=='microsoft');
 }
 function reset(){for(const id of ['mailboxId','mailboxName','mailboxEmail','mailboxPassword','mailboxFolder','mailboxUsername','mailboxHost'])el(id).value='';el('mailboxProvider').value='auto';el('mailboxPort').value=993;el('mailboxActive').checked=true;el('saveMailbox').textContent='Guardar buzón';connectionFields(true);}
 function draft(){return {id:el('mailboxId').value||undefined,name:el('mailboxName').value,email:el('mailboxEmail').value,provider:provider(),host:el('mailboxHost').value,port:Number(el('mailboxPort').value),security:el('mailboxSecurity').value,username:el('mailboxUsername').value,appPassword:el('mailboxPassword').value,folder:el('mailboxFolder').value,active:el('mailboxActive').checked};}
 window.loadMailboxes=async()=>{try{
  message('Cargando buzones...');const data=await api('list');boxes=data.mailboxes;providers=data.providers||providers;
  const selected=el('mailboxProvider').value||'auto';el('mailboxProvider').replaceChildren();
  for(const [key,name] of [['auto','Detectar por el correo'],...Object.entries(providers).map(([key,c])=>[key,c.name])]){const option=document.createElement('option');option.value=key;option.textContent=name;el('mailboxProvider').append(option);}
  el('mailboxProvider').value=selected;render();connectionFields();message(`${boxes.length} buzón(es) registrados. Las claves y tokens nunca se muestran.`);
 }catch(e){message(e.message);}};
 function button(label,fn,style='btn-blue'){const b=document.createElement('button');b.type='button';b.textContent=label;b.className='btn '+style;b.style.margin='2px';b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){message(e.message);}finally{b.disabled=false;}};return b;}
 function render(){el('mailboxRows').replaceChildren();for(const box of boxes){
  const tr=document.createElement('tr');for(const value of [box.name+' — '+(providers[box.provider]?.name||box.provider),box.email,box.active?'Activo':'Inactivo']){const td=document.createElement('td');td.textContent=value;tr.append(td);}
  const actions=document.createElement('td');
  actions.append(button('Editar',()=>{
   el('mailboxId').value=box.id;el('mailboxName').value=box.name;el('mailboxEmail').value=box.email;el('mailboxFolder').value=box.folder||'';el('mailboxPassword').value='';el('mailboxProvider').value=box.provider;el('mailboxHost').value=box.host;el('mailboxPort').value=box.port;el('mailboxSecurity').value=box.security||'tls';el('mailboxUsername').value=box.username||'';el('mailboxActive').checked=!!box.active;el('saveMailbox').textContent='Guardar cambios';connectionFields();message('Editando buzón. Clave vacía conserva la actual; Microsoft permite reconectar con su botón.');
  }));
  actions.append(button('Probar conexión',async()=>{message('Probando conexión IMAP...');const r=await api('test',{id:box.id});message(r.message+' — carpeta: '+r.folder);}));
  actions.append(button(box.active?'Desactivar':'Activar',async()=>{message('Guardando estado...');await api('edit',{id:box.id,active:!box.active});await window.loadMailboxes();}));
  actions.append(button('Eliminar',async()=>{if(!confirm('¿Eliminar el buzón '+box.email+' de la configuración? No se borrarán correos.'))return;await api('delete',{id:box.id});if(el('mailboxId').value===box.id)reset();await window.loadMailboxes();},'btn-red'));
  tr.append(actions);el('mailboxRows').append(tr);
 }}
 el('saveMailbox').onclick=async()=>{
  const b=el('saveMailbox');b.disabled=true;
  try{message('Validando y guardando el buzón...');const data=draft();await api(data.id?'edit':'create',data);reset();await window.loadMailboxes();message('Buzón guardado en GitHub. Disponible para consultas nuevas.');}catch(e){message(e.message);}finally{b.disabled=false;}
 };
 el('connectMicrosoft').onclick=async()=>{
  if(el('microsoftAuthMode').value==='device'){try{await window.startMicrosoftDevice(draft());}catch(e){message(e.message);}return;}
  const b=el('connectMicrosoft');b.disabled=true;popup=window.open('about:blank','mailboxMicrosoft','width=620,height=760');
  try{
   const data=draft();delete data.appPassword;
   const res=await fetch('/api/microsoft/start',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...window.getMailboxAdmin(),payload:data})});const result=await res.json();if(!res.ok)throw new Error(result.error||'No se pudo iniciar Microsoft');
   if(popup)popup.location.href=result.url;else window.location.href=result.url;
   message('Completa la autorización en Microsoft. Si no aparece, permite ventanas emergentes para este sitio.');
  }catch(e){popup?.close();message(e.message);}finally{b.disabled=false;}
 };
 window.addEventListener('message',async event=>{
  if(event.origin!==location.origin||event.source!==popup||event.data?.type!=='mailbox-microsoft-result')return;
  if(event.data.success){reset();await window.loadMailboxes();message('Microsoft conectado y guardado en GitHub.');}else message('No se completó la conexión. Revisa el mensaje en la ventana de Microsoft.');
 });
 el('mailboxSecurity').addEventListener('change',()=>{el('mailboxPort').value=el('mailboxSecurity').value==='starttls'?143:993;});
 el('microsoftAuthMode').addEventListener('change',()=>connectionFields());
 el('mailboxProvider').addEventListener('change',()=>connectionFields(true));
 el('mailboxEmail').addEventListener('change',()=>{if(el('mailboxProvider').value==='auto')connectionFields(true);});
 el('refreshMailboxes').onclick=()=>window.loadMailboxes();el('cancelMailboxEdit').onclick=()=>{reset();message('Edición cancelada');};
 el('btnLogout').addEventListener('click',()=>{reset();boxes=[];popup?.close();popup=null;el('mailboxRows').replaceChildren();message('');});
})();
