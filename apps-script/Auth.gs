/** Signup verification + password login. Secrets never leave the server. */
function now_(){return new Date().toISOString();}
function id_(){return Utilities.getUuid();}
function hash_(value){const secret=setting_('AUTH_SECRET');if(!secret)throw new Error('SETUP_REQUIRED');return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(String(value),secret));}
function email_(value){const email=String(value||'').trim().toLowerCase();if(email.length>200||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter a valid email address.');return email;}
function owner_(email){return setting_('OWNER_EMAILS').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).includes(email);}
function publicUser_(u){return {user_id:u.user_id,name:u.name,email:u.email,role:owner_(u.email)?'owner':'customer',status:u.status,email_verified:ChatEngine.active(u.email_verified),created_at:u.created_at,last_login:u.last_login};}
function findUser_(email){const matches=rows_('Users').filter(u=>String(u.email).trim().toLowerCase()===email);if(matches.length>1)throw new Error('ACCOUNT_DATA_ERROR');return matches[0];}
function rate_(key,limit,seconds){const props=PropertiesService.getScriptProperties(),name='RATE_'+hash_(key);let record;try{record=JSON.parse(props.getProperty(name)||'null');}catch(e){}if(!record||record.until<Date.now())record={count:0,until:Date.now()+seconds*1000};if(record.count>=limit)throw new Error('Too many requests. Please try again later.');record.count++;props.setProperty(name,JSON.stringify(record));}
function password_(value){if(typeof value!=='string'||value.length<15||value.length>128)throw new Error('Enter a password between 15 and 128 characters.');return value;}
function derivePassword_(password,salt,iterations){if(iterations!==600000)throw new Error('PASSWORD_FORMAT_ERROR');return sjcl.codec.hex.fromBits(sjcl.misc.pbkdf2(password,salt,iterations,256));}
function equal_(a,b){a=String(a||'');b=String(b||'');let diff=a.length^b.length;for(let i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return diff===0;}
function requestCode_(payload){
 const email=email_(payload.email),password=password_(payload.password),name=typeof payload.name==='string'?payload.name.trim():'';
 if(!name||name.length>100||/[\r\n\x00-\x1f]/.test(name))throw new Error('Enter your full name (up to 100 characters).');
 rate_('mail-global',Number(setting_('MAX_LOGIN_EMAILS_PER_DAY'))||80,86400);rate_('signup-global',30,3600);rate_('mail:'+email,5,3600);rate_('cooldown:'+email,1,60);
 const existing=findUser_(email);
 if(existing?.password_hash)throw new Error('This email already has a password. Please log in.');
 if(existing&&existing.status!=='active')throw new Error('This account is not active. Contact the owner.');
 const salt=id_()+id_(),iterations=600000,passwordHash=derivePassword_(password,salt,iterations);
 const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,hash_(id_()+id_()));
 const code=String(bytes.slice(0,5).reduce((a,b)=>a*256+(b&255),0)%100000000).padStart(8,'0');
 const record={email,code_hash:hash_(email+':signup:'+code),purpose:'signup',name,password_hash:passwordHash,password_salt:salt,password_iterations:iterations,expires_at:Date.now()+600000,attempts:0,sent_at:now_()};
 if(!update_('_AuthCodes','email',email,record))append_('_AuthCodes',record);
 MailApp.sendEmail({to:email,subject:'Verify your U&I Mart account',body:'Your U&I Mart verification code is: '+code+'\n\nIt expires in 10 minutes. This code verifies signup/password setup, not a normal login. If you did not request it, ignore this email.',name:'U&I Mart'});
 return{success:true,message:'Check your email for an 8-digit verification code. It expires in 10 minutes.'};
}
function verifyCode_(payload){
 const email=email_(payload.email),code=String(payload.code||'');if(!/^\d{8}$/.test(code))throw new Error('Enter the 8-digit code from your email.');rate_('verify-global',100,3600);
 const c=rows_('_AuthCodes').find(r=>r.email===email);
 if(!c||c.purpose!=='signup'||!c.password_hash||Number(c.expires_at)<=Date.now()||Number(c.attempts)>=5)throw new Error('Code expired or attempt limit reached. Sign up again.');
 update_('_AuthCodes','email',email,{attempts:Number(c.attempts)+1});
 if(!equal_(c.code_hash,hash_(email+':signup:'+code)))throw new Error('The code is incorrect. Please try again.');
 let user=findUser_(email);if(user?.password_hash)throw new Error('This email already has a password. Please log in.');if(user&&user.status!=='active')throw new Error('This account is not active.');
 const patch={name:c.name,email,role:owner_(email)?'owner':'customer',email_verified:true,password_hash:c.password_hash,password_salt:c.password_salt,password_iterations:Number(c.password_iterations)};
 if(user)update_('Users','user_id',user.user_id,patch);else{user={user_id:id_(),status:'active',created_at:now_(),last_login:'',...patch};append_('Users',user);}
 rows_('_Sessions').filter(s=>s.user_id===user.user_id).forEach(s=>update_('_Sessions','token_hash',s.token_hash,{revoked:true}));
 update_('_AuthCodes','email',email,{expires_at:0,code_hash:'',password_hash:'',password_salt:'',name:'',purpose:''});
 activity_({...user,...patch},payload.session_id,'SIGNUP','Email verified and password set');
 return{success:true,message:'Email verified. Log in with your email and password.'};
}
function login_(payload){
 const email=email_(payload.email),password=password_(payload.password);rate_('password-global',100,3600);rate_('password:'+email,10,900);
 const user=findUser_(email),actual=derivePassword_(password,user?.password_salt||'unregistered-account-dummy-salt',Number(user?.password_iterations)||600000);
 if(!user||!ChatEngine.active(user.email_verified)||!user.password_hash||!equal_(actual,user.password_hash)||user.status!=='active'){
  DataService.saveLoginLog({log_id:id_(),user_id:user?.user_id||'',user_email:email,login_time:now_(),status:'failed',session_id:payload.session_id});throw new Error('Email or password is incorrect, or the account is unavailable.');
 }
 const token=id_()+id_(),expires_at=Date.now()+8*3600000,authSession=id_(),last_login=now_();
 update_('Users','user_id',user.user_id,{last_login,role:owner_(email)?'owner':'customer'});
 append_('_Sessions',{token_hash:hash_(token),user_id:user.user_id,session_id:authSession,expires_at,revoked:false});
 DataService.saveLoginLog({log_id:id_(),user_id:user.user_id,user_email:email,login_time:last_login,status:'success',session_id:authSession});activity_(user,authSession,'LOGIN','Signed in with password');
 return{success:true,token,expires_at,user:publicUser_({...user,last_login})};
}
function authError_(message){const error=new Error(message);error.code='AUTH_REQUIRED';return error;}
function authenticate_(token,required){
 if(!token){if(required)throw authError_('Please sign in to continue.');return null;}
 if(typeof token!=='string'||token.length>150)throw authError_('Please sign in again.');
 const session=rows_('_Sessions').find(s=>s.token_hash===hash_(token)&&!ChatEngine.active(s.revoked)&&Number(s.expires_at)>Date.now());
 if(!session)throw authError_('Your session has expired. Please sign in again.');
 const user=rows_('Users').find(u=>u.user_id===session.user_id&&u.status==='active');if(!user)throw authError_('This account is not active.');
 if(!user.password_hash||!ChatEngine.active(user.email_verified))throw authError_('Please complete Sign Up once to set your password.');
 return Object.assign({},user,{role:owner_(user.email)?'owner':'customer',auth_session:session.session_id});
}
function logout_(token){const user=authenticate_(token,true);update_('_Sessions','token_hash',hash_(token),{revoked:true});update_('Login_Logs','session_id',user.auth_session,{logout_time:now_()});activity_(user,user.auth_session,'LOGOUT','Signed out');return{success:true};}
function cleanupPrivateRecords(){const lock=LockService.getScriptLock();lock.waitLock(20000);try{
 ['_Sessions','_AuthCodes'].forEach(name=>{const sheet=sheet_(name),headers=headers_(sheet),index=headers.indexOf('expires_at');if(sheet.getLastRow()<2)return;const values=sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();for(let i=values.length-1;i>=0;i--)if(Number(values[i][index])<Date.now())sheet.deleteRow(i+2);});
 const props=PropertiesService.getScriptProperties(),all=props.getProperties();Object.keys(all).filter(k=>k.startsWith('RATE_')).forEach(k=>{try{if(JSON.parse(all[k]).until<Date.now())props.deleteProperty(k);}catch(e){props.deleteProperty(k);}});
 }finally{lock.releaseLock();}}
