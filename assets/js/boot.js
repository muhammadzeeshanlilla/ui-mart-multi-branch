import { validateSession, useStoredSession, loginUrl, homeUrl } from './session.js';
const isLogin=document.body.dataset.page==='login';
function renderDashboardValidationShell(){
  document.getElementById('site-header').innerHTML='<div class="container header-inner"><a class="logo" href="../index.html" aria-label="U and I Mart home"><span class="logo-mark">u&i</span><span class="logo-name">U&I MART<small>EVERYDAY. TOGETHER.</small></span></a></div>';
  document.getElementById('main').innerHTML='<div class="container dashboard-shell dashboard-validation-shell"><div class="dashboard-header"><div><p class="eyebrow">U&I MART / OWNER WORKSPACE</p><h1>Your business, at a glance.</h1></div></div><span class="inline-loader" role="status" aria-label="Loading"></span></div>';
}
if(isLogin){
  await import('./auth.js?v=20260922-2');
  await import('./chatbot.js?v=20260922-3');
}else{
  window.addEventListener('auth-expired',()=>location.replace(loginUrl()));
  try{
    const isDashboard=document.body.dataset.page==='dashboard';
    if(isDashboard){
      renderDashboardValidationShell();
      const user=await validateSession();
      if(!user)location.replace(loginUrl());
      else if(user.role!=='owner')location.replace(homeUrl);
      else await import('./main.js');
    }else if(useStoredSession()){
      await import('./main.js');
      validateSession().catch(()=>{});
    }else{
      const user=await validateSession();
      if(!user)location.replace(loginUrl());
      else await import('./main.js');
    }
    // Revalidate browser back/forward-cache restores without hiding the document.
    window.addEventListener('pageshow',event=>{if(event.persisted)validateSession().catch(()=>{});});
  }catch(error){
    const target=document.getElementById('main');target.replaceChildren();
    const message=document.createElement('p');message.className='container status error';message.textContent=error.message+' ';
    const retry=document.createElement('button');retry.className='button';retry.textContent='Try again';retry.onclick=()=>location.reload();message.append(retry);target.append(message);
  }
}
