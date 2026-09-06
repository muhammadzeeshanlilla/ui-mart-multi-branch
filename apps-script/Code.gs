function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
function doGet(){return json_({success:true,service:'U&I Mart API',version:1});}
function chatRate_(sessionId){
  const cache=CacheService.getScriptCache(),key='chat:'+sessionId;let window;
  try{window=JSON.parse(cache.get(key)||'null');}catch(error){}
  if(!window||typeof window!=='object'||!Number.isFinite(window.until)||window.until<=Date.now())window={count:0,until:Date.now()+60000};
  if(window.count>=20)throw new Error('Please wait a minute before asking another question.');
  window.count++;
  // Preserve the first request's deadline instead of extending it on every message.
  cache.put(key,JSON.stringify(window),Math.max(1,Math.ceil((window.until-Date.now())/1000)));
}
function doPost(e){
  let locked=false;const lock=LockService.getScriptLock();
  try{
    const raw=e&&e.postData&&e.postData.contents;if(!raw||raw.length>12000)throw new Error('Invalid request.');
    let payload;try{payload=JSON.parse(raw);}catch(error){throw new Error('Invalid JSON request.');}
    if(!payload||typeof payload!=='object'||Array.isArray(payload))throw new Error('Invalid request.');
    const actions=['branches','deals','chat','requestCode','verifyCode','me','logout','dashboard'];
    if(!actions.includes(payload.action))throw new Error('Unknown action.');
    if(!/^[A-Za-z0-9_-]{3,64}$/.test(String(payload.session_id||'')))throw new Error('Invalid session identifier.');
    if(payload.action==='branches')return json_({success:true,branches:DataService.getBranches()});
    if(payload.action==='deals'){
      const activeBranches=DataService.getBranches();
      return json_({success:true,deals:DataService.getDeals().filter(d=>activeBranches.some(b=>b.city===d.branch))});
    }
    // Public reads do not need to queue behind chat/authentication writes.
    lock.waitLock(20000);locked=true;
    if(payload.action==='requestCode')return json_(requestCode_(payload));
    if(payload.action==='verifyCode')return json_(verifyCode_(payload));
    if(payload.action==='logout')return json_(logout_(payload.token));
    const user=authenticate_(payload.token,payload.action!=='chat');
    if(payload.action==='me')return json_({success:true,user:{user_id:user.user_id,name:user.name,email:user.email,role:user.role}});
    if(payload.action==='dashboard')return json_(dashboard_(user,payload));
    const message=typeof payload.message==='string'?payload.message.trim():'';
    if(!message||message.length>500)throw new Error('Ask a question between 1 and 500 characters.');
    // Global persistent ceiling plus per-session cache rate. Do not trust a client ID as identity.
    rate_('chat-global',Number(setting_('MAX_CHATS_PER_HOUR'))||500,3600);
    chatRate_(payload.session_id);
    const context=payload.context&&typeof payload.context==='object'&&!Array.isArray(payload.context)?payload.context:{};
    const result=ChatEngine.answer(message,{products:DataService.getProducts(),deals:DataService.getDeals(),branches:DataService.getBranches()},context);
    DataService.saveChatLog({chat_id:id_(),session_id:payload.session_id,user_id:user?user.user_id:'',user_name:user?user.name:'Guest',user_message:message,bot_response:JSON.stringify(result),detected_intent:result.intent,detected_branch:result.branch||'',detected_category:result.category||'',detected_product:result.products.map(p=>p.name).join(', '),timestamp:now_()});
    return json_(result);
  }catch(error){
    const known=/^(Enter |Check |Code |The code |Too many |Please |Your session |This account |Owner access |Invalid |Unknown |Ask a question)/;
    const message=known.test(error.message)?error.message:'The service is temporarily unavailable. Please try again later.';
    console.error('U&I API error: '+error.message);return json_({success:false,message});
  }finally{if(locked)lock.releaseLock();}
}
