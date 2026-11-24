import {test} from 'node:test';
import assert from 'node:assert/strict';
import {microsoftDevice} from '../lib/microsoft-device-handler.js';
import {FIXED_ADMIN} from '../lib/admin-auth.js';
import {THUNDERBIRD_CLIENT_ID} from '../lib/microsoft-public-client.js';
import {decryptOAuth,mailboxCredential} from '../lib/microsoft-oauth.js';
import {encode64,decode64} from '../lib/encoding.js';
const env={GITHUB_TOKEN:'fake',GITHUB_REPO:'owner/repo',MAILBOX_ENCRYPTION_KEY:'device-key-'.repeat(6)};
const credentials={adminUser:FIXED_ADMIN.username,adminPass:FIXED_ADMIN.password};
function fixture(){
 const original=globalThis.fetch,clock=Date.now;let now=clock(),cookie='',flowId,revision=1,doc={version:1,mailboxes:[]},tokenState='pending',writes=0,tokenCalls=0,probes=0,acceptProbe=true,requests=[];
 Date.now=()=>now;
 globalThis.fetch=async(url,options)=>{
  const body=new URLSearchParams(options.body);
  if(url.includes('login.microsoftonline.com')){
   assert.equal(body.get('client_id'),THUNDERBIRD_CLIENT_ID);assert.equal(body.has('client_secret'),false);assert.equal(body.has('redirect_uri'),false);requests.push({url,body});
   if(url.endsWith('/devicecode'))return Response.json({device_code:'private-device-code',user_code:'TEST-CODE',verification_uri:'https://microsoft.com/devicelogin',expires_in:900,interval:5});
   tokenCalls++;if(body.get('grant_type')==='refresh_token'){assert.equal(body.get('refresh_token'),'private-refresh');return Response.json({access_token:'refreshed-access',refresh_token:'rotated-refresh',expires_in:3600});}
   assert.equal(body.get('device_code'),'private-device-code');
   if(tokenState==='pending')return Response.json({error:'authorization_pending'},{status:400});
   if(tokenState==='slow')return Response.json({error:'slow_down'},{status:400});
   if(tokenState==='denied')return Response.json({error:'authorization_declined'},{status:400});
   if(tokenState==='expired')return Response.json({error:'expired_token'},{status:400});
   return Response.json({access_token:'private-access',refresh_token:'private-refresh',expires_in:3600});
  }
  assert.match(url,/api.github.com\/repos\/owner\/repo\/contents\/mailboxes.json/);
  if(options.method==='PUT'){const b=JSON.parse(options.body);assert.equal(b.sha,''+revision);doc=JSON.parse(decode64(b.content));revision++;writes++;return Response.json({commit:{sha:''+revision}});}
  return Response.json({sha:''+revision,content:encode64(JSON.stringify(doc))});
 };
 const call=async(action,extra={},auth=credentials)=>{
  const r=await microsoftDevice({env,request:new Request('https://site.test/api/microsoft/device',{method:'POST',headers:cookie?{Cookie:cookie}:{},body:JSON.stringify({...auth,action,flowId,acceptPublicClient:true,payload:{email:'me@hotmail.com',name:'My Hotmail'},...extra})})},async(box,token)=>{probes++;assert.equal(box.email,'me@hotmail.com');assert.equal(token.accessToken,'private-access');if(!acceptProbe)throw new Error('wrong mailbox');return {folder:'INBOX'};});
  const next=r.headers.get('Set-Cookie');if(next)cookie=next.split(';')[0];const data=await r.json();if(data.flowId)flowId=data.flowId;
  assert.ok(!JSON.stringify(data).includes('private-'));return {status:r.status,data,cookie:next};
 };
 return {call,advance(ms){now+=ms;},state(v){tokenState=v;},get tokenCalls(){return tokenCalls;},get writes(){return writes;},get probes(){return probes;},get doc(){return doc;},requests,rejectProbe(){acceptProbe=false;},setCookie(v){cookie=v;},restore(){globalThis.fetch=original;Date.now=clock;}};
}
test('Device flow with original five vars: start, enforced wait, pending, approval, IMAP probe and encrypted persistence',async()=>{
 const f=fixture();try{
  const start=await f.call('start');assert.equal(start.status,200);assert.equal(start.data.userCode,'TEST-CODE');assert.match(start.cookie,/HttpOnly; Secure; SameSite=Strict/);
  assert.equal((await f.call('poll')).status,202);assert.equal(f.tokenCalls,0);
  f.advance(5000);assert.equal((await f.call('poll')).status,202);assert.equal(f.tokenCalls,1);
  f.state('success');f.advance(5000);const complete=await f.call('poll');assert.equal(complete.status,200);assert.equal(complete.data.success,true);assert.equal(f.writes,1);assert.equal(f.probes,1);assert.match(complete.cookie,/Max-Age=0/);
  assert.ok(!JSON.stringify(f.doc).includes('private-'));const token=await decryptOAuth(f.doc.mailboxes[0],env);assert.equal(token.kind,'device');assert.equal(token.clientId,THUNDERBIRD_CLIENT_ID);
  // Renewal must use the original public client even if Web secrets/config change.
  f.advance(3600000);const credential=await mailboxCredential(f.doc.mailboxes[0],{...env,MICROSOFT_CLIENT_SECRET:'never-send-this'});assert.equal(credential.accessToken,'refreshed-access');assert.equal((await decryptOAuth(f.doc.mailboxes[0],env)).refreshToken,'rotated-refresh');assert.equal(f.writes,2);
 }finally{f.restore();}
});
test('Device polling honors slow_down and does not request tokens early',async()=>{
 const f=fixture();try{
  await f.call('start');f.advance(5000);f.state('slow');const slow=await f.call('poll');assert.equal(slow.status,202);assert.equal(slow.data.interval,10);
  f.advance(5000);assert.equal((await f.call('poll')).data.interval,5);assert.equal(f.tokenCalls,1);
  f.advance(5000);f.state('pending');assert.equal((await f.call('poll')).status,202);assert.equal(f.tokenCalls,2);assert.equal(f.writes,0);
 }finally{f.restore();}
});
test('Device authentication, explicit public-client acknowledgment, flow binding, cookie forgery and expiration',async()=>{
 const f=fixture();try{
  assert.equal((await f.call('start',{},{})).status,401);assert.equal(f.requests.length,0);
  assert.equal((await f.call('start',{acceptPublicClient:false})).status,400);
  await f.call('start');assert.equal((await f.call('poll',{flowId:'wrong'})).status,410);assert.equal(f.tokenCalls,0);
  await f.call('start');f.setCookie('__Host-mailbox_msdevice=forged');assert.equal((await f.call('poll')).status,410);
  await f.call('start');f.advance(901000);assert.equal((await f.call('poll')).status,410);assert.equal(f.tokenCalls,0);
 }finally{f.restore();}
});
test('Denied/expired authorization and failed mailbox probe never save data',async()=>{
 for(const state of ['denied','expired','success']){
  const f=fixture();try{await f.call('start');f.state(state);f.advance(5000);if(state==='success')f.rejectProbe();const result=await f.call('poll');assert.ok(result.status>=400);assert.equal(f.writes,0);assert.equal(f.doc.mailboxes.length,0);}finally{f.restore();}
 }
});
test('Device flow cancel clears state; concurrent duplicate insertion cannot be overwritten',async()=>{
 const f=fixture();try{
  await f.call('start');const cancelled=await f.call('cancel');assert.match(cancelled.cookie,/Max-Age=0/);assert.equal((await f.call('poll')).status,410);
  await f.call('start');f.doc.mailboxes.push({id:'other',email:'me@hotmail.com',active:1});f.advance(5000);f.state('success');assert.equal((await f.call('poll')).status,409);assert.equal(f.writes,0);assert.equal(f.doc.mailboxes[0].id,'other');
 }finally{f.restore();}
});
