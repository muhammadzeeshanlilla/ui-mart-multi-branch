import { api } from './api.js';
const inFlight=new Map();
const ttl=120000;
export function cachedData(action){
  try{const item=JSON.parse(sessionStorage.getItem('ui_shared_'+action));return item&&Date.now()-item.at<ttl?item.data:null;}catch{return null;}
}
export function sharedData(action){
  if(!['branches','deals'].includes(action))throw new Error('Invalid shared data request.');
  if(!inFlight.has(action))inFlight.set(action,api(action).then(data=>{try{sessionStorage.setItem('ui_shared_'+action,JSON.stringify({at:Date.now(),data}));}catch{}return data;}).finally(()=>inFlight.delete(action)));
  return inFlight.get(action);
}
