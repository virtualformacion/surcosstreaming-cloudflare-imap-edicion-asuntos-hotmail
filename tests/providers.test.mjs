import {test} from 'node:test';
import assert from 'node:assert/strict';
import {detectProvider,connectionConfig,storedConnection,mailboxPassword} from '../lib/mail-providers.js';
import {ImapClient} from '../lib/imap-protocol.js';
import {mailboxHandler} from '../lib/mailbox-handler.js';
import {FIXED_ADMIN} from '../lib/admin-auth.js';
import {encryptPassword,decryptPassword} from '../lib/mailbox-vault.js';
import {microsoftStart,microsoftCallback} from '../lib/microsoft-handler.js';
import {encryptOAuth,decryptOAuth,mailboxCredential} from '../lib/microsoft-oauth.js';
import {encode64,decode64} from '../lib/encoding.js';
const env={GITHUB_TOKEN:'fake',GITHUB_REPO:'owner/repo',MAILBOX_ENCRYPTION_KEY:'tests-only-key-'.repeat(5),MICROSOFT_CLIENT_ID:'client',MICROSOFT_CLIENT_SECRET:'client-secret',MICROSOFT_REDIRECT_URI:'https://site.test/api/microsoft/callback'};
const credentials={adminUser:FIXED_ADMIN.username,adminPass:FIXED_ADMIN.password};
const req=(input,cookie,path='/api/microsoft/start')=>new Request('https://site.test'+path,{method:'POST',headers:cookie?{Cookie:cookie}:{},body:JSON.stringify(input)});
function github(doc={version:1,mailboxes:[]}){
 let sha='1',writes=0;
 return {doc,get sha(){return sha;},get writes(){return writes;},fetch:async(url,options)=>{
  assert.match(url,/api.github.com\/repos\/owner\/repo\/contents\/mailboxes.json/);
  if(options.method==='PUT'){const b=JSON.parse(options.body);if(b.sha&&b.sha!==sha)return new Response('{}',{status:409});const next=JSON.parse(decode64(b.content));doc.mailboxes=next.mailboxes;sha=String(+sha+1);writes++;return Response.json({commit:{sha}});}
  return Response.json({sha,content:encode64(JSON.stringify(doc))});
 }};
}
test('Provider registry, legacy Gmail, regional/custom hosts and passwords without corrupting spaces',()=>{
 assert.equal(detectProvider('A@HOTMAIL.COM'),'microsoft');assert.equal(detectProvider('a@zoho.com'),'zoho');assert.equal(detectProvider('a@unknown.org'),'custom');
 assert.equal(storedConnection({email:'business@mydomain.org'}).host,'imap.gmail.com');
 assert.equal(connectionConfig({email:'a@yahoo.com'}).host,'imap.mail.yahoo.com');
 assert.equal(connectionConfig({email:'a@domain.org',provider:'zoho',host:'imappro.zoho.eu'}).host,'imappro.zoho.eu');
 const c=connectionConfig({email:'a@domain.org',provider:'custom',host:'mail.domain.org',port:1993,username:'login'});assert.equal(c.username,'login');assert.equal(c.port,1993);
 assert.equal(mailboxPassword(' ab c ! ','custom'),' ab c ! ');assert.equal(mailboxPassword('abcd efgh ijkl mnop','gmail'),'abcdefghijklmnop');
 for(const host of ['127.0.0.1','::1','localhost','server.local','https://mail.domain.org','mail.domain.org:993'])assert.throws(()=>connectionConfig({email:'a@domain.org',provider:'custom',host}));
 assert.throws(()=>connectionConfig({email:'a@domain.org',provider:'custom',host:'outlook.office365.com'}));
 assert.throws(()=>mailboxPassword('a\r\nLOGIN other','custom'));
});
function wire(responder){let controller,closed=false;const commands=[];const enc=new TextEncoder();return {commands,get closed(){return closed;},socket:{readable:new ReadableStream({start(c){controller=c;c.enqueue(enc.encode('* OK IMAP ready\r\n'));}}),writable:new WritableStream({write(bytes){const command=new TextDecoder().decode(bytes).trimEnd();commands.push(command);const result=responder(command);if(result)controller.enqueue(enc.encode(result));}}),close:async()=>{closed=true;try{controller.close();}catch{}}}};}
test('Real IMAP wire uses custom TLS endpoint, escaped LOGIN and INBOX fallback',async()=>{
 const mock=wire(command=>command.split(' ')[0]+' OK done\r\n');let endpoint;
 const client=new ImapClient((address,options)=>{endpoint={address,options};return mock.socket;});
 await client.open('a@domain.org','a b"c',{email:'a@domain.org',provider:'custom',host:'mail.domain.org',port:1993,username:'login'});
 assert.deepEqual(endpoint,{address:{hostname:'mail.domain.org',port:1993},options:{secureTransport:'on'}});
 assert.match(mock.commands[0],/LOGIN "login" "a b\\"c"/);assert.equal(await client.folder(''),'INBOX');await client.close();assert.ok(mock.closed);
});
test('Microsoft XOAUTH2 handles server rejection continuation and never uses LOGIN',async()=>{
 let address;const mock=wire(command=>command.includes('AUTHENTICATE')?'+ eyJlcnJvciI6dHJ1ZX0=\r\n':command===''?'A1 NO auth failed\r\n':'');
 const client=new ImapClient(a=>{address=a;return mock.socket;});
 await assert.rejects(()=>client.open('a@hotmail.com',{accessToken:'private-token'},{email:'a@hotmail.com',provider:'microsoft'}),/rechazó/);
 assert.equal(address.hostname,'outlook.office365.com');assert.ok(mock.closed);assert.ok(!mock.commands.some(s=>s.includes('LOGIN')));
 const payload=mock.commands[0].split(' ').at(-1);assert.equal(atob(payload),'user=a@hotmail.com\x01auth=Bearer private-token\x01\x01');
});
test('Custom mailbox CRUD encrypts arbitrary password, preserves it on edit, hides secrets and rejects endpoint changes without password',async()=>{
 const original=globalThis.fetch,g=github();globalThis.fetch=g.fetch;let probes=0;
 const call=async(action,payload)=>mailboxHandler({env,request:req({...credentials,action,payload})},async(box,password)=>{probes++;assert.equal(box.host,'mail.domain.org');assert.equal(password,' pass with spaces! ');return {folder:'INBOX'};});
 try{
  assert.equal((await call('create',{email:'a@domain.org',provider:'custom',host:'mail.domain.org',appPassword:' pass with spaces! '})).status,200);
  const id=g.doc.mailboxes[0].id;assert.ok(g.doc.mailboxes[0].password_encrypted);assert.equal((await call('edit',{id,name:'new'})).status,200);
  const listed=JSON.stringify(await (await call('list')).json());assert.ok(!listed.includes('pass with spaces'));assert.ok(!listed.includes('password_encrypted'));
  assert.equal((await call('edit',{id,host:'other.domain.org'})).status,400);assert.equal((await call('create',{email:'a@hotmail.com',provider:'microsoft'})).status,400);assert.equal(probes,2);
 }finally{globalThis.fetch=original;}
});
async function begin(){const res=await microsoftStart({env,request:req({...credentials,payload:{email:'a@hotmail.com',name:'Hotmail',active:true}})});assert.equal(res.status,200);return {cookie:res.headers.get('Set-Cookie').split(';')[0],url:new URL((await res.json()).url)};}
test('OAuth state/PKCE/cookie, successful IMAP-verified encrypted persistence and no plaintext token exposure',async()=>{
 const original=globalThis.fetch,g=github();let tokenCall,probes=0;
 globalThis.fetch=async(url,options)=>{if(url.includes('login.microsoftonline.com')){tokenCall=new URLSearchParams(options.body);return Response.json({access_token:'access-private',refresh_token:'refresh-private',expires_in:3600});}return g.fetch(url,options);};
 try{
  const {cookie,url}=await begin();assert.equal(url.searchParams.get('code_challenge_method'),'S256');assert.ok(url.searchParams.get('scope').includes('IMAP.AccessAsUser.All'));
  const cb='https://site.test/api/microsoft/callback?code=code&state='+url.searchParams.get('state');
  const response=await microsoftCallback({env,request:new Request(cb,{headers:{Cookie:cookie}})},async(box,credential)=>{probes++;assert.equal(box.email,'a@hotmail.com');assert.equal(credential.accessToken,'access-private');return {folder:'INBOX'};});
  assert.equal(response.status,200);assert.equal(probes,1);assert.ok(response.headers.get('Set-Cookie').includes('Max-Age=0'));assert.equal(g.doc.mailboxes.length,1);
  assert.equal(tokenCall.get('redirect_uri'),env.MICROSOFT_REDIRECT_URI);assert.ok(tokenCall.get('code_verifier'));assert.ok(!JSON.stringify(g.doc).includes('private'));
  const saved=await decryptOAuth(g.doc.mailboxes[0],env);assert.equal(saved.refreshToken,'refresh-private');
  const list=await mailboxHandler({env,request:req({...credentials,action:'list'})},()=>{});assert.ok(!JSON.stringify(await list.json()).includes('oauth_encrypted'));
 }finally{globalThis.fetch=original;}
});
test('OAuth missing/forged/wrong-state/cancelled/expired cookies fail before token exchange; no admin gives no cookie',async()=>{
 const original=globalThis.fetch,g=github();let exchanges=0;globalThis.fetch=async(url,options)=>{if(url.includes('login.microsoftonline.com')){exchanges++;throw new Error('must not exchange');}return g.fetch(url,options);};
 try{
  assert.equal((await microsoftStart({env,request:req({adminUser:'bad',adminPass:'bad',payload:{email:'a@hotmail.com'}})})).status,401);
  const {cookie,url}=await begin(),state=url.searchParams.get('state');
  for(const [suffix,c] of [['code=x&state='+state,''],['code=x&state=wrong',cookie],['code=x&state='+state,cookie+'broken'],['error=access_denied&state='+state,cookie]]){
   const res=await microsoftCallback({env,request:new Request('https://site.test/api/microsoft/callback?'+suffix,{headers:{Cookie:c}})},()=>{throw new Error('must not probe');});assert.equal(res.status,400);
  }
  const raw=decodeURIComponent(cookie.slice(cookie.indexOf('=')+1));const pending=JSON.parse(await decryptPassword(raw,env.MAILBOX_ENCRYPTION_KEY,'microsoft-pending-v1'));pending.exp=0;
  const expired='__Host-mailbox_microsoft='+encodeURIComponent(await encryptPassword(JSON.stringify(pending),env.MAILBOX_ENCRYPTION_KEY,'microsoft-pending-v1'));
  assert.equal((await microsoftCallback({env,request:new Request('https://site.test/api/microsoft/callback?code=x&state='+state,{headers:{Cookie:expired}})},()=>{})).status,400);assert.equal(exchanges,0);
 }finally{globalThis.fetch=original;}
});
test('Microsoft refresh rotates encrypted token and retains current record metadata, valid cached token avoids exchange',async()=>{
 const original=globalThis.fetch,box={id:'ms',email:'a@hotmail.com',provider:'microsoft',active:1,name:'keep',folder:'INBOX'};
 box.oauth_encrypted=await encryptOAuth({accessToken:'old',refreshToken:'old-refresh',expiresAt:0},env,box.id);const g=github({version:1,mailboxes:[box]});let exchanges=0;
 globalThis.fetch=async(url,options)=>{if(url.includes('login.microsoftonline.com')){exchanges++;const b=new URLSearchParams(options.body);assert.equal(b.get('grant_type'),'refresh_token');assert.equal(b.get('refresh_token'),'old-refresh');return Response.json({access_token:'new-access',refresh_token:'new-refresh',expires_in:3600});}return g.fetch(url,options);};
 try{
  assert.deepEqual(await mailboxCredential(box,env),{accessToken:'new-access'});assert.equal(g.doc.mailboxes[0].name,'keep');assert.equal((await decryptOAuth(g.doc.mailboxes[0],env)).refreshToken,'new-refresh');assert.equal(g.writes,1);
  assert.deepEqual(await mailboxCredential(g.doc.mailboxes[0],env),{accessToken:'new-access'});assert.equal(exchanges,1);
 }finally{globalThis.fetch=original;}
});
test('Failed token exchange and failed IMAP validation never persist Microsoft mailbox',async()=>{
 const original=globalThis.fetch,g=github();let deny=true;globalThis.fetch=async(url,options)=>url.includes('login.microsoftonline.com')?deny?Response.json({error:'invalid_grant',error_description:'DO NOT LEAK'},{status:400}):Response.json({access_token:'token',refresh_token:'refresh',expires_in:3600}):g.fetch(url,options);
 try{
  for(const failure of [true,false]){deny=failure;const {cookie,url}=await begin();const res=await microsoftCallback({env,request:new Request('https://site.test/api/microsoft/callback?code=x&state='+url.searchParams.get('state'),{headers:{Cookie:cookie}})},()=>{throw new Error('private IMAP details');});assert.ok(res.status>=400);const html=await res.text();assert.ok(!html.includes('DO NOT LEAK'));assert.ok(!html.includes('private IMAP details'));assert.equal(g.writes,0);}
 }finally{globalThis.fetch=original;}
});
test('STARTTLS upgrades before credentials and fails closed when server refuses it',async()=>{
 let upgraded=false;const encrypted=wire(command=>{assert.ok(upgraded);return command.split(' ')[0]+' OK done\r\n';});
 const plain=wire(command=>{assert.match(command,/STARTTLS$/);return command.split(' ')[0]+' OK upgrade\r\n';});
 // Unlike a new IMAP connection, the TLS-upgraded stream has no new greeting.
 const noGreetingReader=encrypted.socket.readable.getReader();await noGreetingReader.read();noGreetingReader.releaseLock();
 plain.socket.startTls=()=>{upgraded=true;return encrypted.socket;};
 const client=new ImapClient((address,options)=>{assert.equal(address.port,143);assert.equal(options.secureTransport,'starttls');return plain.socket;});
 await client.open('a@example.org','secret',{email:'a@example.org',provider:'custom',host:'mail.example.org',security:'starttls'});assert.ok(upgraded);assert.match(encrypted.commands[0],/LOGIN/);await client.close();
 const denied=wire(command=>command.split(' ')[0]+' NO no TLS\r\n');const failed=new ImapClient(()=>denied.socket);
 await assert.rejects(()=>failed.open('a@example.org','secret',{email:'a@example.org',provider:'custom',host:'mail.example.org',security:'starttls'}));assert.equal(denied.commands.length,1);assert.ok(denied.closed);
});
