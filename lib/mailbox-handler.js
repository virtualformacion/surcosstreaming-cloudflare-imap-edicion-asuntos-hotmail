import {jsonResponse} from './encoding.js';
import {checkAdmin} from './admin-auth.js';
import {loadMailboxes,saveMailboxes,publicMailboxes} from './mailbox-store.js';
import {encryptPassword,normalizeMailbox,cipherKey} from './mailbox-vault.js';
import {mailboxCredential} from './microsoft-oauth.js';
import {storedConnection,mailboxPassword,MailError,PROVIDERS} from './mail-providers.js';
import {MAX_ACTIVE} from './imap-mail.js';
export async function mailboxHandler({request,env},probe){
 if(request.method!=='POST')return jsonResponse({error:'Use POST'},405);
 let input;try{input=await request.json();}catch{return jsonResponse({error:'JSON inválido'},400);}
 const auth=checkAdmin(input?.adminUser,input?.adminPass);if(auth)return jsonResponse({error:auth.error},auth.status);
 try{
  await cipherKey(env.MAILBOX_ENCRYPTION_KEY);
  const action=input.action,data=input.payload||{};
  if(action==='list')return jsonResponse({mailboxes:await publicMailboxes(env),providers:PROVIDERS});
  if(!['create','edit','delete','test'].includes(action))return jsonResponse({error:'Acción inválida'},400);
  const {mailboxes,sha}=await loadMailboxes(env),old=action==='create'?null:mailboxes.find(b=>b.id===data.id);
  if(action!=='create'&&!old)return jsonResponse({error:'Buzón no encontrado'},404);
  if(action==='delete'){const commit=await saveMailboxes(env,mailboxes.filter(b=>b.id!==old.id),sha,'eliminar');return jsonResponse({success:true,commit});}
  if(action==='test'){const result=await probe(old,await mailboxCredential(old,env));return jsonResponse({success:true,message:'Conexión IMAP TLS correcta',folder:result.folder});}
  const merged={...old,...data};if(old&&!old.provider&&!data.provider)merged.provider='gmail';
  const config=normalizeMailbox(merged),id=old?.id||crypto.randomUUID(),timestamp=new Date().toISOString();
  if(config.active&&(!old||!old.active)&&mailboxes.filter(b=>b.active).length>=MAX_ACTIVE)return jsonResponse({error:`Esta versión admite hasta ${MAX_ACTIVE} buzones activos; desactiva uno primero`},400);
  if(mailboxes.some(b=>b.email.toLowerCase()===config.email&&b.id!==id))return jsonResponse({error:'Ese buzón ya está registrado'},409);
  const before=old?storedConnection(old):null;
  const changed=old&&['provider','host','port','security','username'].some(k=>before[k]!==config[k]);
  let password_encrypted=old?.password_encrypted,oauth_encrypted=old?.oauth_encrypted;
  if(config.auth==='oauth2'){
   if(!old||changed||old.email!==config.email||!oauth_encrypted)throw new MailError('Pulsa Conectar con Microsoft para autorizar este buzón');
   password_encrypted=undefined;
  }else{
   oauth_encrypted=undefined;
   if(data.appPassword)password_encrypted=await encryptPassword(mailboxPassword(data.appPassword,config.provider),env.MAILBOX_ENCRYPTION_KEY,id);
   if(!password_encrypted)throw new MailError('Introduce la clave de aplicación o contraseña IMAP');
   if(old&&(changed||config.email!==old.email)&&!data.appPassword)throw new MailError('Al cambiar la conexión debes introducir nuevamente su contraseña');
  }
  const record={id,...config,...(password_encrypted?{password_encrypted}:{}),...(oauth_encrypted?{oauth_encrypted}:{}),created_at:old?.created_at||timestamp,updated_at:timestamp};
  if(config.active)await probe(record,await mailboxCredential(record,env));
  // A token refresh during validation may have written a newer revision.
  const latest=await loadMailboxes(env);if(latest.sha!==sha)throw new MailError('Otro cambio modificó los buzones. Recarga y repite la operación.',409);
  const commit=await saveMailboxes(env,old?mailboxes.map(b=>b.id===id?record:b):[...mailboxes,record],sha,old?'editar':'crear');
  return jsonResponse({success:true,commit});
 }catch(e){const message=String(e.message||'');const allowed=/^(Configura |GitHub |El archivo |Otro cambio |No se pudo descifrar|Correo del buzón inválido|Carpeta inválida|Nombre del buzón|Introduce |Gmail |El servidor IMAP|No se encontró Todos|La consulta IMAP)/.test(message);return jsonResponse({error:e instanceof MailError||allowed?message:'No se pudo guardar o conectar el buzón. Revisa servidor, acceso IMAP, credenciales y GitHub.'},e instanceof MailError?e.status:500);}
}
