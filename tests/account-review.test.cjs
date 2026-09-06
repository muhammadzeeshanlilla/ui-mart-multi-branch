const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
function setup(){
  const db={Users:[{user_id:'owner',email:'owner@example.test',role:'owner',status:'active'},{user_id:'customer',email:'customer@example.test',role:'customer',status:'active'}],_Sessions:[],Activity_Logs:[],Chat_Logs:[],Login_Logs:[],Deals:[],Branches:[{city:'Dubai',is_active:true}]};
  const c=vm.createContext({Date,console:{error(){}}});
  for(const f of ['Chatbot','Store','Auth','Logs','Code'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/'+f+'.gs'),'utf8'),c);
  c.rows_=name=>db[name].map(row=>({...row})); c.append_=(name,row)=>db[name].push(row); c.id_=()=>String(Math.random());
  c.setting_=key=>key==='OWNER_EMAILS'?'owner@example.test':''; c.hash_=value=>'hash:'+value;
  c.rate_=()=>{}; c.chatRate_=()=>{};
  c.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
  c.ContentService={MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})};
  c.DataService.getProducts=()=>[]; c.DataService.getDeals=()=>db.Deals;
  const request=(action,extras={})=>c.doPost({postData:{contents:JSON.stringify({action,session_id:'review_session',...extras})}});
  const session=(user_id,patch={})=>db._Sessions.push({user_id,token_hash:'hash:'+user_id,session_id:'auth_'+user_id,expires_at:Date.now()+60000,revoked:false,...patch});
  return{c,db,request,session};
}
test('Expired/revoked sessions and disabled users cannot read private APIs',()=>{
  for(const patch of [{expires_at:Date.now()-1},{revoked:true}]){
    const {request,session}=setup();session('owner',patch);
    assert.equal(request('dashboard',{token:'owner',tab:'users'}).success,false);
  }
  const {db,request,session}=setup();session('owner');db.Users[0].status='disabled';
  assert.equal(request('me',{token:'owner'}).success,false);
  assert.equal(request('dashboard',{token:'owner'}).success,false);
});
test('Forged client role and stale Users role cannot grant owner access',()=>{
  const {db,request,session}=setup();session('customer');db.Users[1].role='owner';
  assert.equal(request('me',{token:'customer',role:'owner'}).user.role,'customer');
  assert.equal(request('dashboard',{token:'customer',role:'owner',tab:'users'}).success,false);
});
test('Each guest/signed-in chat creates one attributed row without auth fields',()=>{
  const {db,request,session}=setup();session('customer');
  for(const token of ['', 'customer'])assert.equal(request('chat',{token,message:'Hello'}).success,true);
  assert.equal(db.Chat_Logs.length,2);
  assert.equal(db.Chat_Logs[0].user_id,'');assert.equal(db.Chat_Logs[1].user_id,'customer');
  for(const row of db.Chat_Logs){
    for(const field of ['chat_id','session_id','user_message','bot_response','detected_intent','timestamp'])assert.ok(row[field]);
    assert.doesNotMatch(JSON.stringify(row),/token_hash|code_hash|AUTH_SECRET|"token"/);
  }
});
test('Dashboard activities snapshot includes its own access record',()=>{
  const {c,db}=setup();const result=c.dashboard_({...db.Users[0],auth_session:'auth_owner'},{tab:'activities'});
  assert.equal(result.total,db.Activity_Logs.length);
  assert.equal(result.rows[0]?.action,'DASHBOARD_VIEW');
});
test('Dashboard active-deal count excludes inactive branches',()=>{
  const {c,db}=setup();db.Deals=[{branch:'Dubai'},{branch:'Sharjah'}];
  assert.equal(c.dashboard_(db.Users[0],{tab:'deals'}).summary.deals,1);
});
