import { api, getAuth } from './api.js';
export const siteRoot = new URL('../../', import.meta.url);
export let currentUser = null;
export const homeUrl = new URL('index.html', siteRoot).href;
export function loginUrl() { return new URL('pages/login.html', siteRoot).href; }
export function clearSession() {
  ['ui_auth','ui_auth_validated_at','ui_shared_branches','ui_shared_deals','ui_chat_session'].forEach(k=>sessionStorage.removeItem(k));
}
export function useRecentSession(maxAgeMs = 120000) {
  const auth=getAuth();
  const validatedAt=Number(sessionStorage.getItem('ui_auth_validated_at'));
  if(!auth?.token||!auth.user||!validatedAt||Date.now()-validatedAt>maxAgeMs)return null;
  currentUser=auth.user;
  return currentUser;
}
export function useStoredSession() {
  const auth=getAuth();
  if(!auth?.token||!auth.user)return null;
  currentUser=auth.user;
  return currentUser;
}
export async function validateSession() {
  if (!getAuth()?.token) return null;
  const { user } = await api('me');currentUser=user;
  // This is display state only; each page and every protected API revalidates on the server.
  const auth=getAuth();if(auth)sessionStorage.setItem('ui_auth',JSON.stringify({...auth,user}));
  sessionStorage.setItem('ui_auth_validated_at',String(Date.now()));
  return user;
}
export async function signOut() {
  try{await api('logout');}catch(error){if(error.code!=='AUTH_REQUIRED')throw error;}
  clearSession();location.replace(loginUrl());
}
