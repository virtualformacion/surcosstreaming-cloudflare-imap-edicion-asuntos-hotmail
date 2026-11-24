// Añade proveedores con contraseña aquí; OAuth necesita su integración específica.
export const PROVIDERS={
 gmail:{name:'Gmail',host:'imap.gmail.com',port:993,auth:'password',domains:['gmail.com','googlemail.com']},
 microsoft:{name:'Hotmail / Outlook / Microsoft 365',host:'outlook.office365.com',port:993,auth:'oauth2',domains:['hotmail.com','hotmail.es','outlook.com','outlook.es','live.com','live.com.mx','msn.com']},
 zoho:{name:'Zoho Mail',host:'imap.zoho.com',port:993,auth:'password',domains:['zoho.com','zohomail.com','zoho.eu']},
 yahoo:{name:'Yahoo Mail',host:'imap.mail.yahoo.com',port:993,auth:'password',domains:['yahoo.com','yahoo.es','ymail.com','rocketmail.com']},
 icloud:{name:'iCloud Mail',host:'imap.mail.me.com',port:993,auth:'password',domains:['icloud.com','me.com','mac.com']},
 aol:{name:'AOL Mail',host:'imap.aol.com',port:993,auth:'password',domains:['aol.com']},
 gmx:{name:'GMX',host:'imap.gmx.com',port:993,auth:'password',domains:['gmx.com','gmx.es','gmx.us']},
 custom:{name:'Otro / IMAP personalizado',host:'',port:993,auth:'password',domains:[]}
};
export class MailError extends Error{constructor(message,status=400){super(message);this.status=status;}}
export function detectProvider(email){const domain=String(email).trim().toLowerCase().split('@')[1];return Object.keys(PROVIDERS).find(k=>PROVIDERS[k].domains.includes(domain))||'custom';}
function hostName(value){
 const host=String(value||'').trim().toLowerCase();
 if(host.length>253||!host.includes('.')||!host.split('.').every(s=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s))||/^\d+(?:\.\d+){3}$/.test(host)||/(?:^|\.)(localhost|local|internal|test|invalid|localhost\.localdomain)$/.test(host))throw new MailError('Introduce un servidor IMAP público válido, sin https:// ni puerto');
 return host;
}
export function connectionConfig(data){
 const provider=data.provider==='auto'||!data.provider?detectProvider(data.email):data.provider;
 if(!Object.hasOwn(PROVIDERS,provider))throw new MailError('Proveedor no admitido');
 const preset=PROVIDERS[provider];
 const host=hostName(provider==='microsoft'||provider==='gmail'?preset.host:(data.host||preset.host));
 const security=['microsoft','gmail'].includes(provider)?'tls':(data.security||'tls');
 if(!['tls','starttls'].includes(security))throw new MailError('Elige SSL/TLS o STARTTLS; no se permite acceso sin cifrar');
 const port=Number(provider==='microsoft'||provider==='gmail'?preset.port:(data.port||(security==='starttls'?143:preset.port)));
 if(!Number.isInteger(port)||port<1||port>65535||port===25)throw new MailError('Puerto IMAP inválido');
 if(provider!=='microsoft'&&host==='outlook.office365.com')throw new MailError('Para Microsoft elige Hotmail / Outlook y conecta mediante OAuth2');
 const username=String(data.username||data.email||'').trim();
 if(!username||username.length>320||/[\r\n\0]/.test(username))throw new MailError('Usuario de conexión IMAP inválido');
 return {provider,host,port,security,username:provider==='microsoft'?String(data.email).trim().toLowerCase():username,auth:preset.auth};
}
// Existing records without provider/host are the original Gmail mailboxes.
export function storedConnection(box){return box.provider?connectionConfig(box):connectionConfig({...box,provider:'gmail'});}
export function mailboxPassword(value,provider){
 if(provider==='gmail'){const p=String(value||'').replace(/\s/g,'');if(!/^[a-zA-Z]{16}$/.test(p))throw new MailError('Introduce la clave de aplicación de Google de 16 letras, no la contraseña habitual');return p;}
 const p=String(value||'');if(!p||p.length>4096||/[\r\n\0]/.test(p))throw new MailError('Introduce una contraseña o clave de aplicación válida');return p;
}
