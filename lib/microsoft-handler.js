import {FIXED_ADMIN,checkAdmin} from './admin-auth.js';
import {jsonResponse} from './encoding.js';
import {normalizeMailbox,encryptPassword,decryptPassword} from './mailbox-vault.js';
import {loadMailboxes,saveMailboxes} from './mailbox-store.js';
import {MAX_ACTIVE} from './imap-mail.js';
import {MailError} from './mail-providers.js';
import {microsoftSettings,microsoftAuthorization,microsoftTokens,encryptOAuth} from './microsoft-oauth.js';
const cookieName='__Host-mailbox_microsoft',encoder=new TextEncoder();
function b64(bytes){return btoa(Array.from(bytes,b=>String.fromCharCode(b)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
const nonce=()=>b64(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));}
function cookie(value,maxAge){return `${cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;}
const adminStamp=()=>digest(JSON.stringify(FIXED_ADMIN));
function originCheck(request,env){const s=microsoftSettings(env);if(new URL(s.redirect_uri).origin!==new URL(request.url).origin)throw new MailError('Abre el panel en el dominio de MICROSOFT_REDIRECT_URI',400);return s;}
export async function microsoftStart({request,env}){
 if(request.method!=='POST')return jsonResponse({error:'Use POST'},405);
 let input;try{input=await request.json();}catch{return jsonResponse({error:'JSON inválido'},400);}
 const auth=checkAdmin(input?.adminUser,input?.adminPass);if(auth)return jsonResponse({error:auth.error},auth.status);
 try{
  const s=originCheck(request,env),data=input.payload||{},config=normalizeMailbox({...data,provider:'microsoft'});
  const {mailboxes}=await loadMailboxes(env),old=data.id?mailboxes.find(b=>b.id===data.id):null;
  if(data.id&&!old)throw new MailError('Buzón no encontrado',404);
  if(mailboxes.some(b=>b.email.toLowerCase()===config.email&&b.id!==old?.id))throw new MailError('Ese buzón ya está registrado',409);
  if(config.active&&!old?.active&&mailboxes.filter(b=>b.active).length>=MAX_ACTIVE)throw new MailError(`Esta versión admite hasta ${MAX_ACTIVE} buzones activos`);
  const state=nonce(),verifier=nonce(),id=old?.id||crypto.randomUUID();
  const pending={state,verifier,id,config,old:old?await digest(JSON.stringify(old)):null,exp:Date.now()+600000,admin:await adminStamp(),client:s.client_id};
  const value=await encryptPassword(JSON.stringify(pending),env.MAILBOX_ENCRYPTION_KEY,'microsoft-pending-v1');
  return new Response(JSON.stringify({url:microsoftAuthorization(env,{state,challenge:await digest(verifier),email:config.email})}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie(value,600)}});
 }catch(e){return jsonResponse({error:e instanceof MailError?e.message:'No se pudo iniciar la autorización. Revisa GitHub y la clave de cifrado.'},e instanceof MailError?e.status:500);}
}
function page(success,message,status=200){
 const safe=message.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const n=nonce();
 const html=`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conexión Microsoft</title><body><h1>${success?'Buzón conectado':'No se completó la conexión'}</h1><p>${safe}</p><a href="/admin.html">Volver al administrador</a><script nonce="${n}">if(window.opener){window.opener.postMessage({type:'mailbox-microsoft-result',success:${success}},location.origin);${success?'window.close();':''}}</script></body></html>`;
 return new Response(html,{status,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Set-Cookie':cookie('',0),'Content-Security-Policy':`default-src 'none'; script-src 'nonce-${n}'; base-uri 'none'; frame-ancestors 'none'`,'X-Content-Type-Options':'nosniff'}});
}
export async function microsoftCallback({request,env},probe){
 if(request.method!=='GET')return page(false,'Usa el botón Conectar con Microsoft del administrador.',405);
 try{
  const settings=originCheck(request,env),url=new URL(request.url),raw=request.headers.get('Cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
  if(!raw)throw new MailError('La autorización venció o falta su cookie. Iníciala de nuevo desde el panel.');
  let pending;try{pending=JSON.parse(await decryptPassword(decodeURIComponent(raw),env.MAILBOX_ENCRYPTION_KEY,'microsoft-pending-v1'));}catch{throw new MailError('No se pudo validar la autorización. Iníciala de nuevo desde el panel.');}
  if(!pending.state||url.searchParams.get('state')!==pending.state||pending.exp<Date.now()||pending.admin!==await adminStamp()||pending.client!==settings.client_id||checkAdmin(FIXED_ADMIN.username,FIXED_ADMIN.password))throw new MailError('La autorización venció o no coincide con este navegador. Vuelve a conectar.');
  if(url.searchParams.has('error'))throw new MailError('Microsoft no concedió el permiso o se canceló el acceso. Vuelve a conectar.');
  const code=url.searchParams.get('code');if(!code)throw new MailError('Microsoft no devolvió el código de autorización.');
  const token=await microsoftTokens(env,{grant_type:'authorization_code',code,redirect_uri:settings.redirect_uri,code_verifier:pending.verifier});
  if(!token.refreshToken)throw new MailError('Microsoft no concedió acceso sin conexión. Revisa el permiso offline_access y vuelve a autorizar.');
  const {id,config}=pending;
  // Validate mailbox ownership/alias and real IMAP access before saving.
  await probe({...config,id},{accessToken:token.accessToken});
  const {mailboxes,sha}=await loadMailboxes(env),old=mailboxes.find(b=>b.id===id);
  if(pending.old?( !old||await digest(JSON.stringify(old))!==pending.old):!!old)throw new MailError('El buzón cambió durante la autorización. Actualiza la lista y repite.',409);
  if(mailboxes.some(b=>b.id!==id&&b.email.toLowerCase()===config.email))throw new MailError('Ese buzón ya está registrado',409);
  if(config.active&&!old?.active&&mailboxes.filter(b=>b.active).length>=MAX_ACTIVE)throw new MailError(`Esta versión admite hasta ${MAX_ACTIVE} buzones activos`);
  const timestamp=new Date().toISOString(),record={id,...config,oauth_encrypted:await encryptOAuth(token,env,id),created_at:old?.created_at||timestamp,updated_at:timestamp};
  await saveMailboxes(env,old?mailboxes.map(b=>b.id===id?record:b):[...mailboxes,record],sha,'conectar Microsoft');
  return page(true,'Autorización y conexión IMAP verificadas. El buzón quedó guardado en GitHub.');
 }catch(e){return page(false,e instanceof MailError?e.message:'No se pudo conectar o guardar el buzón. Comprueba el correo autorizado, IMAP habilitado y la configuración de GitHub.',e instanceof MailError?e.status:500);}
}
