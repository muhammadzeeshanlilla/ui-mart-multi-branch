const conversationKey='ui_ai_conversation';
function id(){return globalThis.crypto?.randomUUID?.()||('ai-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
export function conversationId(){let value=sessionStorage.getItem(conversationKey);if(!/^[A-Za-z0-9_-]{8,64}$/.test(value||'')){value=id();sessionStorage.setItem(conversationKey,value);}return value;}
export function requestId(){return id();}
