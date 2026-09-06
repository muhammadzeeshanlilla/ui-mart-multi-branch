import { validateSession, loginUrl } from './session.js';
const isLogin=document.body.dataset.page==='login';
if(isLogin){
  await import('./auth.js');document.documentElement.removeAttribute('data-auth-pending');
}else{
  window.addEventListener('auth-expired',()=>{document.documentElement.setAttribute('data-auth-pending','');location.replace(loginUrl());});
  try{
    const user=await validateSession();
    if(!user)location.replace(loginUrl());
    else{
      await import('./main.js');document.documentElement.removeAttribute('data-auth-pending');
      if(document.body.dataset.page==='home')await import('./chatbot.js');
      // Revalidate browser back/forward-cache restores; never restore visible protected content first.
      window.addEventListener('pagehide',()=>document.documentElement.setAttribute('data-auth-pending',''));
      window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
    }
  }catch(error){
    const target=document.getElementById('access-status');target.textContent=error.message+' ';
    const retry=document.createElement('button');retry.className='button';retry.textContent='Try again';retry.onclick=()=>location.reload();target.append(retry);
  }
}
