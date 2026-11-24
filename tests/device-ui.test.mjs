import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {parseHTML} from 'linkedom';
test('Device panel requires acknowledgment, shows code/client, polls, clears secrets and reloads on success',async()=>{
 const {window}=parseHTML(await readFile(new URL('../admin.html',import.meta.url),'utf8')),el=id=>window.document.getElementById(id);let scheduled,reloaded=0,polls=0;
 window.getMailboxAdmin=()=>({adminUser:'test',adminPass:'test'});window.loadMailboxes=async()=>{reloaded++;};
 const fetch=async(url,options)=>{assert.equal(url,'/api/microsoft/device');const body=JSON.parse(options.body);assert.equal(body.payload?.appPassword,undefined);assert.equal(body.adminUser,'test');
  if(body.action==='start')return Response.json({flowId:'flow',userCode:'MY-CODE',verificationUri:'https://microsoft.com/devicelogin',expiresAt:Date.now()+60000,interval:5,clientName:'Mozilla Thunderbird (prueba experimental)'});
  if(body.action==='poll'){polls++;assert.equal(body.flowId,'flow');return Response.json(polls===1?{pending:true,interval:10}:{success:true});}
  return Response.json({success:true});
 };
 vm.runInNewContext(await readFile(new URL('../microsoft-device-admin.js',import.meta.url),'utf8'),{window,document:window.document,fetch,setTimeout(fn){scheduled=fn;return 1;},clearTimeout(){scheduled=null;}});
 await assert.rejects(()=>window.startMicrosoftDevice({email:'me@hotmail.com'}),/Marca la confirmación/);
 el('acceptPublicMicrosoft').checked=true;await window.startMicrosoftDevice({email:'me@hotmail.com',appPassword:'do not send'});
 assert.equal(el('microsoftDevicePanel').hidden,false);assert.equal(el('microsoftDeviceCode').textContent,'MY-CODE');assert.match(el('microsoftDeviceClient').textContent,/Thunderbird/);
 await scheduled();assert.equal(polls,1);assert.match(el('microsoftDeviceStatus').textContent,/Esperando/);
 await scheduled();assert.equal(polls,2);assert.equal(reloaded,1);assert.equal(el('microsoftDeviceCode').textContent,'');assert.ok(el('microsoftDevicePanel').hidden);
 await window.startMicrosoftDevice({email:'me@hotmail.com'});const stale=scheduled;el('btnLogout').dispatchEvent(new window.Event('click'));await stale();assert.equal(polls,2);assert.equal(el('acceptPublicMicrosoft').checked,false);
});
