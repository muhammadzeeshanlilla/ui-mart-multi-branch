import { api } from './api.js';
import { config } from './config.js';
import { el } from './dom.js';
const main=document.getElementById('main');
async function start(){
  if(config.preview)throw new Error('The owner dashboard requires the live service and an authorized owner sign-in. Preview mode never grants access to private records.');
  const {user}=await api('me');if(user.role!=='owner')throw new Error('This page is reserved for the owner. Please sign in with an authorized owner email.');
  main.innerHTML=`<div class="container dashboard-shell"><div class="dashboard-header"><div><p class="eyebrow">U&I MART / OWNER WORKSPACE</p><h1>Your business, at a glance.</h1><p id="owner-name"></p></div><button id="logout" class="button secondary">Sign out</button></div><div class="summary-grid" id="summary"></div><div class="dashboard-tabs" aria-label="Dashboard sections">${[['chats','Conversations'],['users','Users'],['logins','Login records'],['activities','Activity logs'],['deals','Deals'],['branches','Branches']].map(([id,label])=>`<button class="filter" data-tab="${id}" aria-pressed="${id==='chats'}">${label}</button>`).join('')}<button id="refresh" class="filter">↻ Refresh</button></div><p class="status" id="dashboard-status" role="status" aria-live="polite"></p><div class="records" id="records"></div><div class="pagination"><button class="button secondary" id="previous">← Previous</button><span id="page-count"></span><button class="button secondary" id="next">Next →</button></div></div>`;
  document.getElementById('owner-name').textContent=`Signed in as ${user.name} · ${user.email}`;
  let tab='chats',offset=0,busy=false;
  const state=document.getElementById('dashboard-status');
  document.getElementById('logout').addEventListener('click',async e=>{e.target.disabled=true;try{await api('logout');sessionStorage.removeItem('ui_auth');location.href='login.html';}catch(error){state.textContent=error.message;e.target.disabled=false;}});
  async function load(){
    if(busy)return;busy=true;state.textContent='Loading records…';
    const controls=document.querySelectorAll('.dashboard-tabs button,.pagination button');controls.forEach(b=>b.disabled=true);
    try{
      const data=await api('dashboard',{tab,offset});
      const summary=document.getElementById('summary');summary.replaceChildren();
      [['users','Total users'],['logins','Successful logins'],['chats','Conversations'],['deals','Active deals']].forEach(([key,label])=>{const c=el('div','summary-card');c.append(el('strong','',String(data.summary[key])),el('span','',label));summary.append(c);});
      const records=document.getElementById('records');records.replaceChildren();
      data.rows.forEach(row=>{
        const card=el('article','record');card.append(el('h3','',row.user_message||row.name||row.title||row.branch_name||row.user_email||row.action||'Record'));const dl=el('dl');
        Object.entries(row).filter(([key])=>key!=='bot_response').forEach(([key,value])=>{dl.append(el('dt','',key.replaceAll('_',' ')),el('dd','',String(value??'')));});card.append(dl);
        if(row.bot_response){let response;try{response=JSON.parse(row.bot_response);}catch{response={reply:row.bot_response};}const reply=el('p','status',response.reply);card.append(reply);const details=el('details');details.append(el('summary','','Full assistant response'),el('pre','',JSON.stringify(response,null,2)));card.append(details);}
        records.append(card);
      });
      if(!data.rows.length)records.append(el('p','empty-state','No records yet. New activity will appear here.'));
      document.getElementById('page-count').textContent=`${data.total?offset+1:0}–${Math.min(offset+data.limit,data.total)} of ${data.total}`;
      state.textContent='Updated '+new Date().toLocaleTimeString();controls.forEach(b=>b.disabled=false);
      document.getElementById('previous').disabled=offset===0;document.getElementById('next').disabled=offset+data.limit>=data.total;
    }catch(error){state.textContent=error.message;document.getElementById('records').replaceChildren();controls.forEach(b=>b.disabled=false);}
    finally{busy=false;}
  }
  document.querySelectorAll('[data-tab]').forEach(button=>button.addEventListener('click',()=>{if(busy)return;tab=button.dataset.tab;offset=0;document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));load();}));
  document.getElementById('previous').addEventListener('click',()=>{if(!busy){offset=Math.max(0,offset-25);load();}});
  document.getElementById('next').addEventListener('click',()=>{if(!busy){offset+=25;load();}});
  document.getElementById('refresh').addEventListener('click',()=>load());
  await load();
}
try{await start();}catch(error){
  main.replaceChildren();const box=el('div','container dashboard-message');box.append(el('p','eyebrow','OWNER WORKSPACE'),el('h1','','Sign in to continue'),el('p','',error.message));const link=el('a','button','Go to sign in ↗');link.href='login.html';box.append(link);main.append(box);
}
