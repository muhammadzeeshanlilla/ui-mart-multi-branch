/** Authenticated orchestration for the separate AI shopping assistant. */
function aiChat_(user,payload){
  const message=typeof payload.message==='string'?payload.message.trim():'';
  if(!message||message.length>800)throw new Error('Ask an AI question between 1 and 800 characters.');
  const conversationId=String(payload.conversation_id||'');
  const requestId=String(payload.request_id||'');
  if(!/^[A-Za-z0-9_-]{8,64}$/.test(requestId))throw new Error('Invalid AI request.');
  rate_('ai-user:'+user.user_id,Number(setting_('MAX_AI_REQUESTS_PER_MINUTE'))||12,60);
  rate_('ai-global',Number(setting_('MAX_AI_REQUESTS_PER_HOUR'))||200,3600);
  const cache=CacheService.getScriptCache(),responseKey='ai-response:'+hash_(user.user_id+':'+requestId),existing=cache.get(responseKey);
  if(existing)return JSON.parse(existing);
  const memory=AIMemory.load(user.user_id,conversationId);
  const tools=AITools.build(message,memory);
  const providerMessages=tools.memory_used?memory.messages:[];
  if(tools.reset_memory)memory.messages=[];
  let reply;
  try{reply=AIProvider.generate({message,messages:providerMessages,trusted_data:{intent:tools.intent,filters:tools.filters,products:tools.products,deals:tools.deals,branches:tools.branches}});}
  catch(error){
    if(error.message==='AI_CONFIG_REQUIRED')throw new Error('AI_NOT_CONFIGURED');
    if(error.message==='AI_RATE_LIMIT')throw new Error('The AI service is busy right now. Please try again shortly.');
    throw new Error('The AI service is unavailable right now. Please try again shortly.');
  }
  AIMemory.add(user.user_id,conversationId,memory,message,reply,tools.context);
  const result={success:true,reply,intent:tools.intent,products:tools.products,deals:tools.deals,branches:tools.branches,context:tools.context,conversation_id:conversationId};
  const record={chat_id:id_(),session_id:user.auth_session,conversation_id:conversationId,user_id:user.user_id,user_name:user.name,user_message:message,bot_response:reply,assistant_response:reply,detected_intent:tools.intent,detected_branch:tools.context.branch||'',detected_category:tools.context.category||'',detected_product:tools.products.map(p=>p.name).join(', '),products_referenced:tools.products.map(p=>p.product_id).join(', '),chatbot_type:'ai_assistant',timestamp:now_()};
  const lock=LockService.getScriptLock();lock.waitLock(20000);try{DataService.saveChatLog(record);}finally{lock.releaseLock();}
  cache.put(responseKey,JSON.stringify(result),300);return result;
}

// Run once after copying the AI files. Adds AI log metadata without changing existing rows.
function migrateAIChatbot(){
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{const sheet=sheet_('Chat_Logs'),existing=headers_(sheet),missing=Schema.Chat_Logs.filter(h=>!existing.includes(h));if(missing.length)sheet.getRange(1,existing.length+1,1,missing.length).setValues([missing]);}
  finally{lock.releaseLock();}
}
