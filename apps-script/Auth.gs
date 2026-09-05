/** Passwordless email codes. Role and status are always resolved on the server. */
function now_(){return new Date().toISOString();}
function id_(){return Utilities.getUuid();}
function hash_(value){
  const secret=setting_('AUTH_SECRET');if(!secret)throw new Error('SETUP_REQUIRED');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(value),secret));
}
function email_(value){const email=String(value||'').trim().toLowerCase();if(email.length>200||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');return email;}
function owner_(email){return setting_('OWNER_EMAILS').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email);}
function rate_(key,limit,seconds){
  const props=PropertiesService.getScriptProperties(),name='RATE_'+hash_(key);let record;
  try{record=JSON.parse(props.getProperty(name)||'null');}catch(e){}
  if(!record||record.until<Date.now())record={count:0,until:Date.now()+seconds*1000};
  if(record.count>=limit)throw new Error('Too many requests. Please try again later.');
  record.count++;props.setProperty(name,JSON.stringify(record));
}
function requestCode_(payload){
  const email=email_(payload.email);
  rate_('mail-global',Number(setting_('MAX_LOGIN_EMAILS_PER_DAY'))||80,86400);
  rate_('mail:'+email,5,3600);rate_('cooldown:'+email,1,60);
  const random=hash_(id_()+id_());
  // Eight digits derived from a keyed random challenge, never returned by the API.
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,random);
  const number=bytes.slice(0,5).reduce((a,b)=>a*256+(b&255),0);
  const code=String(number%100000000).padStart(8,'0');
  const record={email,code_hash:hash_(email+':'+code),expires_at:Date.now()+600000,attempts:0,sent_at:now_()};
  if(!update_('_AuthCodes','email',email,record))append_('_AuthCodes',record);
  MailApp.sendEmail({to:email,subject:'Your U&I Mart sign-in code',body:'Your U&I Mart code is: '+code+'\n\nIt expires in 10 minutes and can be used once. If you did not request it, ignore this email.',name:'U&I Mart'});
  return{success:true,message:'Check your email for an 8-digit code. It expires in 10 minutes.'};
}
function verifyCode_(payload){
  const email=email_(payload.email),code=String(payload.code||'');
  if(!/^\d{8}$/.test(code))throw new Error('Enter the 8-digit code from your email.');
  const challenge=rows_('_AuthCodes').find(r=>r.email===email);
  if(!challenge||Number(challenge.expires_at)<Date.now()||Number(challenge.attempts)>=5)throw new Error('Code expired or attempt limit reached. Request a new code.');
  update_('_AuthCodes','email',email,{attempts:Number(challenge.attempts)+1});
  if(challenge.code_hash!==hash_(email+':'+code)){
    DataService.saveLoginLog({log_id:id_(),user_email:email,login_time:now_(),status:'failed',session_id:payload.session_id});
    throw new Error('The code is incorrect. Please try again.');
  }
  update_('_AuthCodes','email',email,{expires_at:0,code_hash:''});
  let user=rows_('Users').find(u=>u.email===email);
  if(user&&user.status!=='active')throw new Error('This account is not active. Contact the owner.');
  const role=owner_(email)?'owner':'customer';
  if(!user){user={user_id:id_(),name:String(payload.name||email.split('@')[0]).trim().slice(0,100),email,role,status:'active',created_at:now_()};append_('Users',user);}
  else{user.role=role;update_('Users','user_id',user.user_id,{role});}
  const token=id_()+id_(),expires_at=Date.now()+8*3600000;
  const authSession=id_();
  append_('_Sessions',{token_hash:hash_(token),user_id:user.user_id,session_id:authSession,expires_at,revoked:false});
  DataService.saveLoginLog({log_id:id_(),user_id:user.user_id,user_email:email,login_time:now_(),status:'success',session_id:authSession});
  activity_(user,authSession,'LOGIN','Signed in with email code');
  return{success:true,token,expires_at,user:{user_id:user.user_id,name:user.name,email:user.email,role}};
}
function authenticate_(token,required){
  if(!token){if(required)throw new Error('Please sign in to continue.');return null;}
  if(typeof token!=='string'||token.length>150)throw new Error('Please sign in again.');
  const session=rows_('_Sessions').find(s=>s.token_hash===hash_(token)&&!ChatEngine.active(s.revoked)&&Number(s.expires_at)>Date.now());
  if(!session)throw new Error('Your session has expired. Please sign in again.');
  const user=rows_('Users').find(u=>u.user_id===session.user_id&&u.status==='active');
  if(!user)throw new Error('This account is not active.');
  return Object.assign({},user,{role:owner_(user.email)?'owner':'customer',auth_session:session.session_id});
}
function logout_(token){
  const user=authenticate_(token,true);
  update_('_Sessions','token_hash',hash_(token),{revoked:true});
  update_('Login_Logs','session_id',user.auth_session,{logout_time:now_()});
  activity_(user,user.auth_session,'LOGOUT','Signed out');return{success:true};
}
function cleanupPrivateRecords(){
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    ['_Sessions','_AuthCodes'].forEach(name=>{const sheet=sheet_(name),headers=headers_(sheet),index=headers.indexOf('expires_at');if(sheet.getLastRow()<2)return;const values=sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();for(let i=values.length-1;i>=0;i--)if(Number(values[i][index])<Date.now())sheet.deleteRow(i+2);});
    const props=PropertiesService.getScriptProperties(),all=props.getProperties();Object.keys(all).filter(k=>k.startsWith('RATE_')).forEach(k=>{try{if(JSON.parse(all[k]).until<Date.now())props.deleteProperty(k);}catch(e){props.deleteProperty(k);}});
  }finally{lock.releaseLock();}
}
