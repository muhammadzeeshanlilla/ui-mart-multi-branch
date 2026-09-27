import { api } from '../../assets/js/api.js';
import { conversationId, requestId } from './ai-memory.js';

export function askAI(message){
  return api('aiChat',{message,conversation_id:conversationId(),request_id:requestId()});
}
