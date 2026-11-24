import {FIXED_ADMIN,checkAdmin} from './admin-auth.js';
import {jsonResponse} from './encoding.js';
import {normalizeMailbox,encryptPassword,decryptPassword} from './mailbox-vault.js';
import {loadMailboxes,saveMailboxes} from './mailbox-store.js';
import {MAX_ACTIVE} from './imap-mail.js';
import {MailError} from './mail-providers.js';
import {MS_SCOPE,encryptOAuth} from './microsoft-oauth.js';
import {digest} from './microsoft-handler.js';
import {publicClient,publicRequest,publicToken,publicError} from './microsoft-public-client.js';
const cookieName='__Host-mailbox_msdevice',context='microsoft-device-pending-v1';
const cookie=(value,age)=>`${cookieName}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
const stamp=()=>digest(JSON.stringify(FIXED_ADMIN));
function json(body,status=200,setCookie){const response=jsonResponse(body,status);if(setCookie)response.headers.set('Set-Cookie',setCookie);return response;}
async function seal(pending,env){const value=await encryptPassword(JSON.stringify(pending),env.MAILBOX_ENCRYPTION_KEY,context);if(encodeURIComponent(value).length>3800)throw new MailError('Microsoft generó una autorización demasiado grande para este modo. Utiliza la conexión de aplicación propia.',502);return cookie(value,Math.max(1,Math.ceil((pending.exp-Date.now())/1000)));}
async function open(request,env,flowId){
 const value=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);let p;
 try{p=JSON.parse(await decryptPassword(decodeURIComponent(value||''),env.MAILBOX_ENCRYPTION_KEY,context));}catch{throw new MailError('La prueba no existe o perdió su cookie. Vuelve a iniciarla.',410);}
 if(p.exp<=Date.now()||p.admin!==await stamp()||p.origin!==new URL(request.url).origin||p.flowId!==flowId)throw new MailError('La prueba venció o no corresponde a esta sesión. Vuelve a iniciarla.',410);
 return p;
}
export async function microsoftDevice({request,env},probe){
 if(request.method!=='POST')return jsonResponse({error:'Use POST'},405);
 let input;try{input=await request.json();}catch{return jsonResponse({error:'JSON inválido'},400);}
 const auth=checkAdmin(input?.adminUser,input?.adminPass);if(auth)return jsonResponse({error:auth.error},auth.status);
 if(new URL(request.url).protocol!=='https:')return jsonResponse({error:'Abre el administrador mediante HTTPS para esta prueba'},400);
 if(input.action==='cancel')return json({success:true},200,cookie('',0));
 if(!['start','poll'].includes(input.action))return jsonResponse({error:'Acción inválida'},400);
 try{
  if(input.action==='start'){
   if(input.acceptPublicClient!==true)throw new MailError('Confirma el uso experimental del cliente público mostrado en el panel');
   const config=normalizeMailbox({...input.payload,provider:'microsoft'}),{mailboxes}=await loadMailboxes(env),old=input.payload?.id?mailboxes.find(b=>b.id===input.payload.id):null;
   if(input.payload?.id&&!old)throw new MailError('Buzón no encontrado',404);
   if(mailboxes.some(b=>b.id!==old?.id&&b.email.toLowerCase()===config.email))throw new MailError('Ese buzón ya está registrado',409);
   if(config.active&&!old?.active&&mailboxes.filter(b=>b.active).length>=MAX_ACTIVE)throw new MailError(`Esta versión admite hasta ${MAX_ACTIVE} buzones activos`);
   const client=publicClient(env),{response,data}=await publicRequest(client,'devicecode',{scope:MS_SCOPE});if(!response.ok)throw publicError(data);
   let verification;try{verification=new URL(data.verification_uri);}catch{throw new MailError('Microsoft no devolvió la dirección de autorización esperada',502);}
   if(verification.protocol!=='https:'||!['microsoft.com','www.microsoft.com','login.microsoftonline.com','login.live.com'].includes(verification.hostname)||verification.username||verification.password||typeof data.device_code!=='string'||typeof data.user_code!=='string')throw new MailError('Microsoft devolvió una autorización no válida',502);
   const interval=Math.max(5,Number(data.interval)||5),pending={...client,config,id:old?.id||crypto.randomUUID(),old:old?await digest(JSON.stringify(old)):null,flowId:crypto.randomUUID(),deviceCode:data.device_code,exp:Date.now()+Math.min(900,Number(data.expires_in)||900)*1000,nextPoll:Date.now()+interval*1000,interval,admin:await stamp(),origin:new URL(request.url).origin};
   return json({flowId:pending.flowId,userCode:data.user_code,verificationUri:verification.href,expiresAt:pending.exp,interval,clientName:client.name},200,await seal(pending,env));
  }
  const pending=await open(request,env,input.flowId);
  if(Date.now()<pending.nextPoll)return json({pending:true,interval:Math.max(1,Math.ceil((pending.nextPoll-Date.now())/1000))},202);
  const {response,data}=await publicRequest(pending,'token',{grant_type:'urn:ietf:params:oauth:grant-type:device_code',device_code:pending.deviceCode});
  if(!response.ok){
   if(['authorization_pending','slow_down'].includes(data.error)){
    if(data.error==='slow_down')pending.interval+=5;pending.nextPoll=Date.now()+pending.interval*1000;
    return json({pending:true,interval:pending.interval},202,await seal(pending,env));
   }
   if(data.error==='authorization_declined')throw new MailError('Se rechazó el permiso en Microsoft. Puedes iniciar otra prueba.',403);
   if(data.error==='expired_token'||data.error==='bad_verification_code')throw new MailError('El código de Microsoft venció o ya no es válido. Inicia otra prueba.',410);
   throw publicError(data);
  }
  const token=publicToken(data,pending);if(!token.refreshToken)throw new MailError('Microsoft no devolvió permiso de renovación. No se guardó el buzón.');
  await probe({...pending.config,id:pending.id},{accessToken:token.accessToken});
  const {mailboxes,sha}=await loadMailboxes(env),old=mailboxes.find(b=>b.id===pending.id);
  if(pending.old?(!old||await digest(JSON.stringify(old))!==pending.old):!!old)throw new MailError('El buzón cambió durante la autorización. Recarga y vuelve a conectar.',409);
  if(mailboxes.some(b=>b.id!==pending.id&&b.email.toLowerCase()===pending.config.email))throw new MailError('Ese buzón ya está registrado',409);
  if(pending.config.active&&!old?.active&&mailboxes.filter(b=>b.active).length>=MAX_ACTIVE)throw new MailError(`Esta versión admite hasta ${MAX_ACTIVE} buzones activos`);
  const now=new Date().toISOString(),record={id:pending.id,...pending.config,oauth_encrypted:await encryptOAuth(token,env,pending.id),created_at:old?.created_at||now,updated_at:now};
  await saveMailboxes(env,old?mailboxes.map(b=>b.id===record.id?record:b):[...mailboxes,record],sha,'conectar Microsoft mediante cliente público');
  return json({success:true,message:'Autorización y acceso IMAP comprobados. Buzón guardado.'},200,cookie('',0));
 }catch(e){const status=e instanceof MailError?e.status:500;return json({error:e instanceof MailError?e.message:'No se pudo verificar o guardar el buzón. Comprueba que autorizaste el correo indicado, IMAP habilitado y GitHub.'},status,status>=500?undefined:cookie('',0));}
}
