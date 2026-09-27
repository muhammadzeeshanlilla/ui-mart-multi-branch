/** Small server-side memory, scoped to the authenticated user and conversation. */
var AIMemory=(function(){
  const limit=8,ttl=21600;
  function conversationId_(value){value=String(value||'');if(!/^[A-Za-z0-9_-]{8,64}$/.test(value))throw new Error('Invalid AI conversation.');return value;}
  function key_(userId,conversationId){return'ai-memory:'+hash_(userId+':'+conversationId_(conversationId));}
  function load(userId,conversationId){let result;try{result=JSON.parse(CacheService.getScriptCache().get(key_(userId,conversationId))||'null');}catch(error){}return result&&Array.isArray(result.messages)?result:{messages:[],context:{}};}
  function save(userId,conversationId,memory){const safe={context:memory.context||{},messages:(memory.messages||[]).slice(-limit).map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'').slice(0,1200)}))};CacheService.getScriptCache().put(key_(userId,conversationId),JSON.stringify(safe),ttl);return safe;}
  function add(userId,conversationId,memory,userMessage,assistantMessage,context){memory=memory||{messages:[],context:{}};memory.messages.push({role:'user',content:userMessage},{role:'assistant',content:assistantMessage});memory.context=context||memory.context||{};return save(userId,conversationId,memory);}
  return{load,save,add};
}());
