import { api, getAuth } from './api.js';
import { config } from './config.js';
import { el } from './dom.js';
const main=document.getElementById('main');
main.innerHTML=`<div class="container login-layout"><section class="login-story"><p class="eyebrow">YOUR U&I CONNECTION</p><h1>A familiar place.<br>A simple sign-in.</h1><p>Use your email to sign in securely. We’ll send a one-time code — no password to remember.</p><p class="small">You can explore our branches and ask the assistant as a guest. Signed-in conversations are linked to your account for customer support.</p><a class="text-link" href="../index.html">← Back to U&I Mart</a></section><section class="login-card" id="auth-card"><h2>Welcome to U&I</h2><p>Customers and owners use the same sign-in. New customers get an account when they verify their email.</p><form id="email-form"><label for="name">Your name (optional for new customers)</label><input id="name" name="name" maxlength="100" autocomplete="name"><label for="email">Email address</label><input id="email" type="email" name="email" autocomplete="email" maxlength="200" required><button class="button" type="submit">Send sign-in code ↗</button></form><form id="code-form" hidden><label for="code">8-digit email code</label><input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required><button class="button" type="submit">Verify & sign in ↗</button><button class="button secondary" id="change-email" type="button">Change email / request another code</button></form><p id="auth-status" class="status" role="status" aria-live="polite"></p><p class="small">Sign-in activity is recorded. The owner can review customer accounts and assistant conversations.</p></section></div>`;
const status=document.getElementById('auth-status');
let email='',name='';
function notify(text,error=false){status.textContent=text;status.classList.toggle('error',error);}
async function run(form,fn){const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);try{await fn();}catch(error){notify(error.message,true);}finally{buttons.forEach(b=>b.disabled=false);}}
document.getElementById('email-form').addEventListener('submit',e=>{
  e.preventDefault();run(e.target,async()=>{
    email=document.getElementById('email').value.trim();name=document.getElementById('name').value.trim();
    const response=await api('requestCode',{email});notify(response.message);
    e.target.hidden=true;document.getElementById('code-form').hidden=false;document.getElementById('code').focus();
  });
});
document.getElementById('code-form').addEventListener('submit',e=>{
  e.preventDefault();run(e.target,async()=>{
    const response=await api('verifyCode',{email,name,code:document.getElementById('code').value.trim()});
    sessionStorage.setItem('ui_auth',JSON.stringify({token:response.token,user:response.user,expires_at:response.expires_at}));
    location.href=response.user.role==='owner'?'owner-dashboard.html':'login.html';
  });
});
document.getElementById('change-email').addEventListener('click',()=>{
  document.getElementById('code-form').hidden=true;document.getElementById('email-form').hidden=false;document.getElementById('code').value='';notify('You can request another code after 60 seconds.');document.getElementById('email').focus();
});
if(config.preview)notify('Preview mode: sign-in is disabled until the live service is connected. You can still explore the website and assistant.');
if(getAuth()&&!config.preview){
  try{
    const {user}=await api('me');const card=document.getElementById('auth-card');card.replaceChildren(el('h2','',`Welcome, ${user.name}`),el('p','',user.email));
    const visit=el('a','button',user.role==='owner'?'Open owner dashboard ↗':'Ask the assistant ↗');visit.href=user.role==='owner'?'owner-dashboard.html':'../index.html#assistant';card.append(visit);
    const logout=el('button','button secondary','Sign out');const state=el('p','status');state.setAttribute('role','status');card.append(logout,state);
    logout.addEventListener('click',async()=>{logout.disabled=true;try{await api('logout');sessionStorage.removeItem('ui_auth');location.reload();}catch(error){state.textContent=error.message;logout.disabled=false;}});
  }catch(error){sessionStorage.removeItem('ui_auth');notify(error.message,true);}
}
