import { config } from './config.js';

export function sessionId() {
  let id = sessionStorage.getItem('ui_chat_session');
  if (!id) { id = crypto.randomUUID(); sessionStorage.setItem('ui_chat_session', id); }
  return id;
}
export function getAuth() {
  try { return JSON.parse(sessionStorage.getItem('ui_auth') || 'null'); } catch { return null; }
}
export async function api(action, payload = {}) {
  if (config.preview) {
    const { previewRequest } = await import('./preview.js');
    return previewRequest(action, payload);
  }
  if (!/^https:\/\/script.google.com\/macros\/s\/.+\/exec$/.test(config.apiUrl)) {
    throw new Error('The service is not connected yet. Please try again later.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ['requestCode','login'].includes(action)?120000:config.timeoutMs);
  try {
    // Retained from the original integration: a simple POST avoids a CORS preflight.
    const response = await fetch(config.apiUrl, {
      method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, action, session_id: sessionId(), token: getAuth()?.token || '' }),
      credentials: 'omit', redirect: 'follow', cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error('The service could not be reached. Please try again.');
    const data = await response.json();
    if (!data || data.success !== true) {
      const error=new Error(data?.message || 'The request could not be completed.');error.code=data?.code;
      if(error.code==='AUTH_REQUIRED'){sessionStorage.removeItem('ui_auth');sessionStorage.removeItem('ui_shared_branches');sessionStorage.removeItem('ui_shared_deals');window.dispatchEvent(new Event('auth-expired'));}
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The service took too long. Please try again.');
    if (error instanceof TypeError || error instanceof SyntaxError) throw new Error('The service could not be reached or returned an invalid response. Please try again.');
    throw error;
  } finally { clearTimeout(timer); }
}
