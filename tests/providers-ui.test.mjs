import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
import {mailboxHandler} from '../lib/mailbox-handler.js';
import {microsoftStart} from '../lib/microsoft-handler.js';
import {FIXED_ADMIN} from '../lib/admin-auth.js';
import {encryptPassword} from '../lib/mailbox-vault.js';
import {encode64,decode64} from '../lib/encoding.js';
const tick=()=>new Promise(resolve=>setTimeout(resolve,5));
test('Real admin DOM: legacy Gmail edit, custom mailbox save and Microsoft authorization options',async()=>{
 const originalFetch=globalThis.fetch;const env={GITHUB_TOKEN:'fake',GITHUB_REPO:'owner/repo',MAILBOX_ENCRYPTION_KEY:'test-key-'.repeat(7),MICROSOFT_CLIENT_ID:'client',MICROSOFT_CLIENT_SECRET:'secret',MICROSOFT_REDIRECT_URI:'https://site.test/api/microsoft/callback'};
 const doc={version:1,mailboxes:[{id:'legacy',name:'Gmail anterior',email:'old@gmail.com',folder:'',active:1,password_encrypted:await encryptPassword('abcdefghijklmnop',env.MAILBOX_ENCRYPTION_KEY,'legacy')}]};let revision=1;
 globalThis.fetch=async(url,options)=>{
  if(options.method==='PUT'){const body=JSON.parse(options.body);assert.equal(body.sha,''+revision);doc.mailboxes=JSON.parse(decode64(body.content)).mailboxes;revision++;return Response.json({commit:{sha:''+revision}});}
  return Response.json({sha:''+revision,content:encode64(JSON.stringify(doc))});
 };
 const html=await readFile(new URL('../admin.html',import.meta.url),'utf8'),{window}=parseHTML(html),el=id=>window.document.getElementById(id);
 Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.getAttribute('data-test-value')||this.querySelector('option')?.getAttribute('value')||'';},set(v){this.setAttribute('data-test-value',v);},configurable:true});
 window.getMailboxAdmin=()=>({adminUser:FIXED_ADMIN.username,adminPass:FIXED_ADMIN.password});
 let opened;window.open=()=>opened={location:{href:'about:blank'},close(){this.closed=true;}};
 const apiFetch=async(url,options)=>{
  const context={env,request:new Request('https://site.test'+url,options)};
  if(url==='/api/microsoft/start')return microsoftStart(context);
  assert.equal(url,'/api/mailboxes');return mailboxHandler(context,async(box,credential)=>{assert.equal(box.host,'mail.example.org');assert.equal(credential,' password with spaces ');return {folder:'INBOX'};});
 };
 try{
  vm.runInNewContext(await readFile(new URL('../mailbox-admin.js',import.meta.url),'utf8'),{window,document:window.document,fetch:apiFetch,confirm:()=>true,location:{origin:'https://site.test'}});
  await window.loadMailboxes();assert.ok(el('mailboxProvider').querySelector('option[value="microsoft"]'));assert.ok(el('mailboxProvider').querySelector('option[value="custom"]'));
  [...el('mailboxRows').querySelectorAll('button')].find(b=>b.textContent==='Editar').click();await tick();assert.equal(el('mailboxProvider').value,'gmail');assert.equal(el('mailboxHost').value,'imap.gmail.com');assert.ok(el('mailboxHost').disabled);
  el('cancelMailboxEdit').click();el('mailboxProvider').value='custom';el('mailboxProvider').dispatchEvent(new window.Event('change'));
  el('mailboxEmail').value='new@example.org';el('mailboxHost').value='mail.example.org';el('mailboxPort').value=993;el('mailboxPassword').value=' password with spaces ';el('mailboxActive').checked=true;
  el('saveMailbox').click();for(let i=0;i<100;i++){await tick();if(!el('saveMailbox').disabled)break;}
  assert.equal(doc.mailboxes.length,2,el('mailboxMsg').textContent);assert.equal(doc.mailboxes[1].provider,'custom');assert.equal(el('mailboxPassword').value,'');
  el('mailboxProvider').value='microsoft';el('mailboxProvider').dispatchEvent(new window.Event('change'));el('mailboxEmail').value='new@hotmail.com';
  assert.ok(el('mailboxPasswordRow').hidden);assert.equal(el('connectMicrosoft').hidden,false);assert.ok(el('saveMailbox').hidden);
  el('microsoftAuthMode').value='web';el('microsoftAuthMode').dispatchEvent(new window.Event('change'));
  el('connectMicrosoft').click();for(let i=0;i<100;i++){await tick();if(!el('connectMicrosoft').disabled)break;}
  assert.equal(new URL(opened.location.href).hostname,'login.microsoftonline.com');
  el('btnLogout').dispatchEvent(new window.Event('click'));assert.equal(opened.closed,true);assert.equal(el('mailboxRows').children.length,0);
 }finally{globalThis.fetch=originalFetch;}
});
