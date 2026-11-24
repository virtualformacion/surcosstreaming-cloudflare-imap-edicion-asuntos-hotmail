(() => {
let credentials={adminUser:'',adminPass:''};
const el=id=>document.getElementById(id);
window.getMailboxAdmin=()=>({...credentials});
async function login(){
 const button=el('btnLogin');button.disabled=true;el('loginMsg').textContent='Comprobando acceso...';
 const candidate={adminUser:el('loginUser').value.trim(),adminPass:el('loginPass').value};
 try{
  const response=await fetch('/api/mailboxes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...candidate,action:'list'})});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'No se pudo entrar');
  credentials=candidate;el('loginBox').classList.add('hidden');el('panel').classList.remove('hidden');el('loginMsg').textContent='';el('loginPass').value='';await window.loadMailboxes();await window.loadSubjects?.();
 }catch(e){credentials={adminUser:'',adminPass:''};el('loginMsg').textContent=e.message;}finally{button.disabled=false;}
}
el('btnLogin').onclick=login;el('loginPass').addEventListener('keydown',e=>{if(e.key==='Enter')login();});
el('btnLogout').addEventListener('click',()=>{credentials={adminUser:'',adminPass:''};el('loginPass').value='';el('panel').classList.add('hidden');el('loginBox').classList.remove('hidden');});
})();
