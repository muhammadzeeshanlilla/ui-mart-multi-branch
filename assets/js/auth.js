import { api, getAuth } from './api.js';
import { el } from './dom.js';
import { validateSession, homeUrl } from './session.js';
const main=document.getElementById('main');
document.getElementById('site-header').innerHTML='<div class="container header-inner"><span class="logo"><span class="logo-mark">u&i</span><span class="logo-name">U&I MART</span></span></div>';
document.getElementById('site-footer').textContent='';
main.innerHTML=`<div class="container login-layout"><section class="login-story"><p class="eyebrow">YOUR U&I CONNECTION</p><h1>Welcome to U&I.</h1><p>Create your account once, verify your email, then log in with your password.</p><p class="small">Already used our email-code login? Choose Sign Up once to set your password with the same email. Your account and history stay together.</p></section><section class="login-card"><div class="filters" aria-label="Account options"><button class="filter" id="show-signup">Sign Up</button><button class="filter" id="show-login">Login</button></div><h2 id="auth-title"></h2>
<form id="signup-form"><label for="name">Full Name</label><input id="name" autocomplete="name" maxlength="100" required><label for="signup-email">Email</label><input id="signup-email" type="email" autocomplete="email" maxlength="200" required><label for="signup-password">Password</label><input id="signup-password" type="password" autocomplete="new-password" minlength="15" maxlength="128" required><p class="small">Use 15–128 characters. A long, unique passphrase works well.</p><label for="confirm-password">Confirm Password</label><input id="confirm-password" type="password" autocomplete="new-password" minlength="15" maxlength="128" required><button class="button" type="submit">Sign Up</button></form>
<form id="code-form" hidden><label for="code">8-digit email verification code</label><input id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{8}" maxlength="8" required><button class="button" type="submit">Verify email</button><button class="button secondary" id="restart-signup" type="button">Start again / request another code</button></form>
<form id="login-form" hidden><label for="email">Email</label><input id="email" type="email" autocomplete="email" maxlength="200" required><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" minlength="15" maxlength="128" required><button class="button" type="submit">Login</button></form><p id="auth-status" class="status" role="status" aria-live="polite"></p></section></div>`;
const status=document.getElementById('auth-status');let pendingEmail='',busy=false;
function show(mode){if(busy)return;for(const id of ['signup','code','login'])document.getElementById(id+'-form').hidden=id!==mode;document.getElementById('auth-title').textContent=mode==='signup'?'Create your account':mode==='code'?'Verify your email':'Welcome back';for(const id of ['signup','login'])document.getElementById('show-'+id).setAttribute('aria-pressed',String(id===mode));status.textContent='';document.querySelectorAll('input[type=password]').forEach(i=>i.value='');}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(error){status.textContent=error.message;status.classList.add('error');}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
document.getElementById('show-signup').onclick=()=>show('signup');document.getElementById('show-login').onclick=()=>show('login');document.getElementById('restart-signup').onclick=()=>show('signup');
document.getElementById('signup-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 const password=document.getElementById('signup-password').value;
 if(password!==document.getElementById('confirm-password').value)throw new Error('Passwords do not match.');
 const email=document.getElementById('signup-email').value.trim().toLowerCase();
 const r=await api('requestCode',{name:document.getElementById('name').value,email,password});pendingEmail=email;
 busy=false;show('code');busy=true;status.textContent=r.message;document.getElementById('code').focus();
});};
document.getElementById('code-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 const r=await api('verifyCode',{email:pendingEmail,code:document.getElementById('code').value});
 document.getElementById('code').value='';localStorage.setItem('ui_returning','1');busy=false;show('login');busy=true;
 document.getElementById('email').value=pendingEmail;status.textContent=r.message;document.getElementById('password').focus();
});};
document.getElementById('login-form').onsubmit=e=>{e.preventDefault();run(async()=>{
 const password=document.getElementById('password');const r=await api('login',{email:document.getElementById('email').value,password:password.value});password.value='';
 sessionStorage.setItem('ui_auth',JSON.stringify({token:r.token,user:r.user,expires_at:r.expires_at}));localStorage.setItem('ui_returning','1');location.replace(homeUrl);
});};
show(localStorage.getItem('ui_returning')?'login':'signup');
if(getAuth()?.token){try{if(await validateSession())location.replace(homeUrl);}catch(error){status.textContent=error.message;}}
