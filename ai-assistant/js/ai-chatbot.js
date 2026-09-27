import { currentUser } from '../../assets/js/session.js';
import { askAI } from './ai-api.js';
import { renderTrustedResults } from './ai-tools.js';

if(document.body.dataset.page==='home'&&currentUser&&!document.getElementById('uiAiAssistant')){
  const host=document.createElement('section');host.id='uiAiAssistant';host.className='ai-assistant';host.setAttribute('aria-label','U&I AI Shopping Assistant');
  host.innerHTML=`<button class="ai-launcher" type="button" aria-controls="aiAssistantPanel" aria-expanded="false"><span aria-hidden="true">✦</span><b>U&amp;I AI Assistant</b></button><div class="ai-panel" id="aiAssistantPanel" role="dialog" aria-modal="false" aria-labelledby="aiAssistantTitle" aria-hidden="true"><header class="ai-header"><span class="ai-mark" aria-hidden="true">AI</span><div><h2 id="aiAssistantTitle">U&amp;I AI Shopping Assistant</h2><p><i></i> Online</p></div><button class="ai-close" type="button" aria-label="Close AI assistant">×</button></header><div class="ai-messages" aria-live="polite"></div><form class="ai-form"><label class="sr-only" for="aiAssistantInput">Ask the AI shopping assistant</label><input id="aiAssistantInput" maxlength="800" autocomplete="off" placeholder="Ask me anything…"><button type="submit" aria-label="Send message">↑</button></form></div>`;
  document.body.append(host);
  const launcher=host.querySelector('.ai-launcher'),panel=host.querySelector('.ai-panel'),close=host.querySelector('.ai-close'),messages=host.querySelector('.ai-messages'),form=host.querySelector('.ai-form'),input=form.querySelector('input'),send=form.querySelector('button');
  let pending=false,scrollState=null;
  function element(tag,className,text){const value=document.createElement(tag);if(className)value.className=className;if(text!==undefined)value.textContent=text;return value;}
  function row(role,text,error=false){const wrap=element('div','ai-message is-'+role),bubble=element('div','ai-bubble'+(error?' is-error':''),text);wrap.append(bubble);messages.append(wrap);messages.scrollTop=messages.scrollHeight;return bubble;}
  const firstName=String(currentUser.name||'there').trim().split(/\s+/)[0];
  row('assistant',`Hi ${firstName} 👋 What are you shopping for today?`);
  const quick=element('div','ai-quick');[['Find a Product','Help me find a product'],['Shop by Budget','I want to shop by budget'],['Compare Products','Help me compare products'],['Current Deals','What current deals are available?']].forEach(([label,value])=>{const button=element('button','',label);button.type='button';button.onclick=()=>{input.value=value;input.focus();};quick.append(button);});messages.append(quick);
  function viewport(){
    const mobile=matchMedia('(max-width: 560px)').matches,open=panel.classList.contains('is-open');
    if(mobile&&open){if(!scrollState){scrollState={y:scrollY,css:document.body.style.cssText};document.body.style.position='fixed';document.body.style.top=-scrollState.y+'px';document.body.style.width='100%';document.body.style.overflow='hidden';}const visual=visualViewport,height=visual?.height||innerHeight,top=visual?.offsetTop||0;panel.style.top=(top+8)+'px';panel.style.height=Math.max(320,height-16)+'px';panel.style.bottom='auto';}
    else{panel.style.removeProperty('top');panel.style.removeProperty('height');panel.style.removeProperty('bottom');if(scrollState){const state=scrollState;scrollState=null;document.body.style.cssText=state.css;scrollTo({top:state.y,behavior:'instant'});}}
  }
  function toggle(open){panel.classList.toggle('is-open',open);panel.setAttribute('aria-hidden',String(!open));panel.inert=!open;launcher.setAttribute('aria-expanded',String(open));viewport();if(open)setTimeout(()=>input.focus({preventScroll:true}),80);else launcher.focus();}
  panel.inert=true;launcher.onclick=()=>toggle(!panel.classList.contains('is-open'));close.onclick=()=>toggle(false);
  document.addEventListener('pointerdown',event=>{if(panel.classList.contains('is-open')&&!host.contains(event.target))toggle(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.classList.contains('is-open'))toggle(false);});
  visualViewport?.addEventListener('resize',viewport);window.addEventListener('resize',viewport);
  form.addEventListener('submit',async event=>{
    event.preventDefault();const message=input.value.trim();if(!message||pending)return;
    pending=true;input.value='';input.disabled=true;send.disabled=true;quick.remove();row('user',message);const typing=row('assistant','Thinking…');typing.classList.add('is-thinking');
    try{const response=await askAI(message);typing.parentElement.remove();const bubble=row('assistant',response.reply);renderTrustedResults(bubble,response);}
    catch(error){typing.parentElement.remove();const configured=error.message==='The AI assistant is not configured yet.';row('assistant',configured?error.message:'I’m having trouble reaching the AI service right now. Please try again shortly.',true);}
    finally{pending=false;input.disabled=false;send.disabled=false;messages.scrollTop=messages.scrollHeight;if(panel.classList.contains('is-open'))input.focus({preventScroll:true});}
  });
}
