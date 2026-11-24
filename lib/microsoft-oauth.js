import {publicRequest,publicToken,publicError} from './microsoft-public-client.js';
import {encryptPassword,decryptPassword} from './mailbox-vault.js';
import {loadMailboxes,saveMailboxes} from './mailbox-store.js';
import {storedConnection,MailError} from './mail-providers.js';
export const MS_SCOPE='https://outlook.office.com/IMAP.AccessAsUser.All offline_access';
const authority='https://login.microsoftonline.com/common/oauth2/v2.0/';
export function microsoftSettings(env){
 for(const name of ['MICROSOFT_CLIENT_ID','MICROSOFT_CLIENT_SECRET','MICROSOFT_REDIRECT_URI'])if(!env[name])throw new MailError('Configura '+name+' en Cloudflare para conectar Microsoft',503);
 let url;try{url=new URL(env.MICROSOFT_REDIRECT_URI);}catch{throw new MailError('Configura MICROSOFT_REDIRECT_URI con la URL HTTPS de callback',503);}
 if(url.protocol!=='https:'||url.pathname!=='/api/microsoft/callback'||url.search||url.hash||url.username||url.password)throw new MailError('Configura MICROSOFT_REDIRECT_URI como https://tu-dominio/api/microsoft/callback',503);
 return {client_id:env.MICROSOFT_CLIENT_ID,client_secret:env.MICROSOFT_CLIENT_SECRET,redirect_uri:url.href};
}
export function microsoftAuthorization(env,{state,challenge,email}){
 const s=microsoftSettings(env),q=new URLSearchParams({client_id:s.client_id,redirect_uri:s.redirect_uri,response_type:'code',response_mode:'query',scope:MS_SCOPE,state,code_challenge:challenge,code_challenge_method:'S256',prompt:'select_account',login_hint:email});
 return authority+'authorize?'+q;
}
export async function microsoftTokens(env,parameters){
 const s=microsoftSettings(env);let response;
 try{response=await fetch(authority+'token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:s.client_id,client_secret:s.client_secret,...parameters}),signal:AbortSignal.timeout(15000)});}catch{throw new MailError('Microsoft no respondió. Intenta conectar nuevamente.',502);}
 let token;try{token=await response.json();}catch{throw new MailError('Microsoft devolvió una respuesta inválida',502);}
 if(!response.ok||typeof token.access_token!=='string')throw new MailError(token.error==='invalid_grant'?'Microsoft requiere que vuelvas a conectar este buzón desde Administrar.':'Microsoft no autorizó la conexión. Revisa registro de aplicación, permisos y secreto.',400);
 return {accessToken:token.access_token,refreshToken:token.refresh_token,expiresAt:Date.now()+Math.max(1,Number(token.expires_in)||3600)*1000};
}
export const encryptOAuth=(data,env,id)=>encryptPassword(JSON.stringify(data),env.MAILBOX_ENCRYPTION_KEY,id+':oauth2');
export async function decryptOAuth(box,env){return JSON.parse(await decryptPassword(box.oauth_encrypted,env.MAILBOX_ENCRYPTION_KEY,box.id+':oauth2'));}
async function rememberRefresh(box,token,env){
 const encrypted=await encryptOAuth(token,env,box.id);
 for(let attempt=0;attempt<2;attempt++){
  const {mailboxes,sha}=await loadMailboxes(env),current=mailboxes.find(b=>b.id===box.id);
  if(!current)throw new MailError('El buzón se eliminó durante la consulta',409);
  // A reconnect or another refresh must not be overwritten by an older request.
  if(current.oauth_encrypted!==box.oauth_encrypted)return;
  const records=mailboxes.map(b=>b.id===box.id?{...b,oauth_encrypted:encrypted}:b);
  try{await saveMailboxes(env,records,sha,'renovar autorización Microsoft',{skipBuild:true});return;}catch(e){if(attempt===1||!e.message.startsWith('Otro cambio'))throw e;}
 }
}
export async function mailboxCredential(box,env){
 if(storedConnection(box).auth!=='oauth2')return decryptPassword(box.password_encrypted,env.MAILBOX_ENCRYPTION_KEY,box.id);
 if(!box.oauth_encrypted)throw new MailError('Conecta este buzón mediante Microsoft desde Administrar');
 const saved=await decryptOAuth(box,env);
 if(saved.accessToken&&saved.expiresAt>Date.now()+120000)return {accessToken:saved.accessToken};
 if(!saved.refreshToken)throw new MailError('Vuelve a conectar este buzón mediante Microsoft');
 let token;
 if(saved.kind==='device'){const {response,data}=await publicRequest(saved,'token',{grant_type:'refresh_token',refresh_token:saved.refreshToken,scope:MS_SCOPE});if(!response.ok)throw publicError(data);token=publicToken(data,saved);}
 else token=await microsoftTokens(env,{grant_type:'refresh_token',refresh_token:saved.refreshToken,scope:MS_SCOPE});
 token.refreshToken ||= saved.refreshToken;
 await rememberRefresh(box,token,env);
 return {accessToken:token.accessToken};
}
