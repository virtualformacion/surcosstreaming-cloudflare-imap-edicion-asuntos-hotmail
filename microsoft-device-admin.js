(()=>{
 const el=id=>document.getElementById(id);let timer=null,flow=null,busy=false,generation=0;
 async function api(body){const r=await fetch('/api/microsoft/device',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...window.getMailboxAdmin(),...body})});const d=await r.json();if(!r.ok)throw new Error(d.error||'No se pudo completar la prueba Microsoft');return d;}
 function stop(){generation++;clearTimeout(timer);timer=null;flow=null;el('microsoftDeviceCode').textContent='';el('microsoftDeviceLink').removeAttribute('href');el('microsoftDevicePanel').hidden=true;}
 function schedule(seconds,g){clearTimeout(timer);timer=setTimeout(()=>poll(g),Math.max(1,seconds)*1000);}
 async function poll(g){
  if(g!==generation||!flow)return;
  if(Date.now()>=flow.expiresAt){stop();el('mailboxMsg').textContent='El código Microsoft venció. Puedes iniciar otra prueba.';return;}
  try{
   const d=await api({action:'poll',flowId:flow.flowId});if(g!==generation)return;
   if(d.success){stop();await window.loadMailboxes();el('cancelMailboxEdit').click();el('mailboxMsg').textContent='Buzón Microsoft guardado después de comprobar IMAP. Ya puedes probar una consulta.';return;}
   el('microsoftDeviceStatus').textContent='Esperando tu autorización en Microsoft...';schedule(d.interval||5,g);
  }catch(e){if(g!==generation)return;stop();el('mailboxMsg').textContent=e.message;}
 }
 window.startMicrosoftDevice=async payload=>{
  if(busy)return;
  if(!el('acceptPublicMicrosoft').checked)throw new Error('Marca la confirmación del cliente público experimental antes de iniciar la prueba.');
  busy=true;stop();const g=generation;el('connectMicrosoft').disabled=true;
  try{
   const data={...payload};delete data.appPassword;
   const d=await api({action:'start',payload:data,acceptPublicClient:true});if(g!==generation)return;
   flow=d;el('microsoftDeviceClient').textContent='Cliente de autorización: '+d.clientName;
   el('microsoftDeviceCode').textContent=d.userCode;el('microsoftDeviceLink').href=d.verificationUri;el('microsoftDevicePanel').hidden=false;
   el('microsoftDeviceStatus').textContent='Introduce el código en la página oficial de Microsoft. No compartas este código.';
   el('mailboxMsg').textContent='Prueba iniciada. Completa la autorización con el enlace de abajo.';schedule(d.interval||5,g);
  }finally{busy=false;el('connectMicrosoft').disabled=false;}
 };
 el('cancelMicrosoftDevice').onclick=async()=>{stop();try{await api({action:'cancel'});}catch{}el('mailboxMsg').textContent='Prueba cancelada.';};
 for(const id of ['mailboxProvider','microsoftAuthMode','mailboxEmail'])el(id).addEventListener('change',()=>{if(flow)el('cancelMicrosoftDevice').click();});
 el('btnLogout').addEventListener('click',()=>{stop();el('acceptPublicMicrosoft').checked=false;});
 window.addEventListener('pagehide',stop);
})();
