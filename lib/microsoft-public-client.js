import {MailError} from './mail-providers.js';
// Public identifier published by Mozilla; not a secret or our application's identity.
// Experimental interoperability test only. A public ID does not transfer ownership.
export const THUNDERBIRD_CLIENT_ID='9e5f94bc-e8a4-4e73-b8be-63364c29d753';
export function publicClient(env={}){
 const clientId=env.MICROSOFT_DEVICE_CLIENT_ID||THUNDERBIRD_CLIENT_ID;
 if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(clientId))throw new MailError('MICROSOFT_DEVICE_CLIENT_ID debe ser un ID de cliente público válido',503);
 return {clientId,tenant:'consumers',kind:'device',name:clientId===THUNDERBIRD_CLIENT_ID?'Mozilla Thunderbird (prueba experimental)':'Cliente público configurado'};
}
export function publicTokenClient(client){
 if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(client.clientId)||!['consumers','common','organizations'].includes(client.tenant))throw new MailError('La autorización guardada tiene un cliente público inválido');
 return {client_id:client.clientId,authority:`https://login.microsoftonline.com/${client.tenant}/oauth2/v2.0/`};
}
export async function publicRequest(client,path,fields){
 const {client_id,authority}=publicTokenClient(client);let response,data;
 try{response=await fetch(authority+path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id,...fields}),signal:AbortSignal.timeout(15000)});data=await response.json();}catch{throw new MailError('Microsoft no respondió al cliente público. Puedes volver a intentarlo.',502);}
 return {response,data};
}
export function publicError(data){
 const codes=(Array.isArray(data?.error_codes)?data.error_codes:[]).filter(n=>Number.isInteger(n)).slice(0,3).map(n=>'AADSTS'+n).join(', ');
 return new MailError('Microsoft no autorizó el cliente público'+(codes?' ('+codes+')':'')+'. Puede requerir reconexión, otro cliente o una aplicación propia.',400);
}
export function publicToken(data,client){
 if(typeof data.access_token!=='string'||!data.access_token)throw publicError(data);
 return {accessToken:data.access_token,refreshToken:data.refresh_token,expiresAt:Date.now()+Math.max(1,Number(data.expires_in)||3600)*1000,kind:'device',clientId:client.clientId,tenant:client.tenant};
}
