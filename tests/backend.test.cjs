const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const context=vm.createContext({console,Date});
for(const file of ['Chatbot.gs','Store.gs','Auth.gs','Logs.gs','Code.gs']) vm.runInContext(fs.readFileSync(path.join(root,'apps-script',file),'utf8'),context,{filename:file});
const engine=context.ChatEngine;
const branches=[['AD','Abu Dhabi','Electronics'],['DU','Dubai','Furniture'],['SH','Sharjah','Hardware & Pipes']].map(([branch_id,city,specialization])=>({branch_id,city,branch_name:city,specialization,is_active:true,phone:city==='Dubai'?'+971 4 000 0000':'',opening_hours:'',address:''}));
const products=[['TV','Smart TV','Electronics','Abu Dhabi','tv television',1299,5],['SOFA','Sofa','Furniture','Dubai','sofa sofas couch',1599,2],['PIPE','PVC pipe','Pipes','Sharjah','pipe pipes pvc',18,20],...branches.map(b=>[b.branch_id+'K','Kitchen set','Kitchen Items',b.city,'kitchen cookware',99,b.city==='Sharjah'?0:4])].map(([product_id,product_name,category,branch,keywords,price,quantity])=>({product_id,product_name,category,branch,keywords,price,quantity,is_active:true}));
const deals=[{deal_id:'D1',title:'Furniture + free kitchen set',branch:'Dubai',category:'Furniture',free_item:'Kitchen Set',description:'Sample',is_active:true,start_date:'2026-09-01',end_date:'2026-09-30'}];
const data={branches,products,deals};
const answer=(q,c={})=>engine.answer(q,data,c,'2026-09-05T12:00:00Z');
const examples=[['I need furniture','Dubai'],['Where can I buy a sofa?','Dubai'],['Do you sell TV?','Abu Dhabi'],['TV price?','Abu Dhabi'],['Which branch has electronics?','Abu Dhabi'],['I need pipes','Sharjah'],['Pipe available?','Sharjah'],['What is the Dubai deal?','Dubai'],['Any deal on furniture?','Dubai'],['Which branch gives a free kitchen set?','Dubai'],['Where is the Sharjah branch?','Sharjah'],['Give me Dubai contact number','Dubai'],['Furniture kaha milega?','Dubai'],['Pipe kidhar milay ga?','Sharjah']];
for(const [q,branch] of examples)test(q,()=>{const r=answer(q);assert.equal(r.success,true);assert.equal(r.branch,branch);assert.notEqual(r.intent,'CLARIFY');assert.ok(r.reply.length>20);});
for(const q of ['Do all branches have kitchen items?','Kitchen items kis branch main hain?'])test(q,()=>{const r=answer(q);assert.equal(new Set(r.products.map(p=>p.branch)).size,3);assert.match(r.reply,/all three/);});
test('What deals are available?',()=>assert.equal(answer('What deals are available?').deals.length,1));
test('Follow-up price retains product and branch',()=>{const first=answer('Any sofa available?');const next=answer('What is its price?',first.context);assert.equal(next.products[0].product_id,'SOFA');assert.equal(next.intent,'PRICE');});
test('New topic clears previous product scope',()=>{const first=answer('sofa');assert.equal(answer('TV price',first.context).branch,'Abu Dhabi');});
test('Typo and synonym understanding',()=>{assert.equal(answer('furnitur kaha milega').branch,'Dubai');assert.equal(answer('Any couch available').products[0].product_id,'SOFA');});
test('Wrong branch never leaks another branch product',()=>assert.equal(answer('TV in Dubai').products.length,0));
test('Unknown furniture product does not return unrelated stock',()=>assert.equal(answer('Do you have a wardrobe').products.length,0));
test('Out-of-stock kitchen record stays branch specific',()=>{const r=answer('Kitchen in Sharjah');assert.equal(r.products[0].quantity,0);assert.equal(r.products[0].stock_status,'out_of_stock');});
test('Inactive products and branches are excluded',()=>{const changed=structuredClone(data);changed.products[0].is_active=false;assert.equal(engine.answer('TV',changed).products.length,0);changed.branches[1].is_active=false;assert.equal(engine.answer('sofa',changed).products.length,0);});
test('Deal date boundaries use UAE inclusive days',()=>{assert.equal(engine.activeDeals(deals,'2026-09-30T19:59:59Z').length,1);assert.equal(engine.activeDeals(deals,'2026-09-30T20:00:00Z').length,0);});
test('Unknown message gives helpful clarification',()=>assert.match(answer('purple unicorn').reply,/What product or branch/));
test('Unknown quantity and price are not fabricated',()=>{const d=structuredClone(data);d.products[0].price='';d.products[0].quantity='';const r=engine.answer('TV',d);assert.equal(r.products[0].price,null);assert.equal(r.products[0].quantity,null);assert.equal(r.products[0].stock_status,'unknown');});
test('A product-specific deal is never offered for another product in its category',()=>{
  const d=structuredClone(data);d.deals=[{...deals[0],product_id:'SOFA'},{...deals[0],deal_id:'OTHER',product_id:'BED'}];
  const r=engine.answer('sofa',d,{},'2026-09-05T12:00:00Z');assert.equal(r.deals.length,1);assert.equal(r.deals[0].product_id,'SOFA');
});
test('Date-only sheet cells retain the spreadsheet calendar date',()=>{
  const old=context.Utilities;
  context.Utilities={formatDate:(d,tz,format)=>{assert.equal(format,'yyyy-MM-dd');return new Intl.DateTimeFormat('en-CA',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit'}).format(d);}};
  try{assert.equal(context.value_(new Date('2026-08-31T19:00:00Z'),'start_date','Asia/Karachi'),'2026-09-01');assert.equal(context.value_(new Date('2026-09-29T19:00:00Z'),'end_date','Asia/Karachi'),'2026-09-30');}
  finally{context.Utilities=old;}
});
test('Spreadsheet formula injection is escaped',()=>{for(const s of ['=IMPORTXML("x")','+123',' @SUM(A1)','-1'])assert.ok(context.cell_(s).startsWith("'"));assert.equal(context.cell_(5),5);});
test('Frontend engine matches canonical backend',()=>{const src=fs.readFileSync(path.join(root,'apps-script/Chatbot.gs'),'utf8').replaceAll('\r\n','\n');const copy=fs.readFileSync(path.join(root,'assets/js/chat-engine.js'),'utf8').replaceAll('\r\n','\n');assert.ok(copy.includes(src));});

// In-memory provider for auth and routing tests; no real email or Google account.
const db={_AuthCodes:[],_Sessions:[],Users:[],Login_Logs:[],Activity_Logs:[]};
const props={AUTH_SECRET:'test-only-secret',OWNER_EMAILS:'owner@example.test'};
context.setting_=k=>props[k]||'';context.rate_=()=>{};
context.rows_=name=>db[name]||[];
context.append_=(name,record)=>(db[name]??=[]).push({...record});
context.update_=(name,key,value,patch)=>{const row=(db[name]||[]).find(r=>r[key]===value);if(!row)return false;Object.assign(row,patch);return true;};
context.Utilities={getUuid:()=>crypto.randomUUID(),computeHmacSha256Signature:(v,k)=>crypto.createHmac('sha256',k).update(v).digest(),base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url'),computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest()),DigestAlgorithm:{SHA_256:'SHA256'}};
let lastMail;context.MailApp={sendEmail:m=>{lastMail=m;}};
context.DataService.saveLoginLog=r=>db.Login_Logs.push(r);context.DataService.saveActivityLog=r=>db.Activity_Logs.push(r);
test('OTP lifecycle, owner gate, token hashing, logout and replay protection',()=>{
  context.requestCode_({email:'owner@example.test'});
  const code=lastMail.body.match(/\d{8}/)[0];assert.notEqual(db._AuthCodes[0].code_hash,code);
  assert.throws(()=>context.verifyCode_({email:'owner@example.test',code:'00000000',session_id:'test'}),/incorrect/);
  const signed=context.verifyCode_({email:'owner@example.test',code,session_id:'test',role:'customer'});
  assert.equal(signed.user.role,'owner');assert.notEqual(db._Sessions[0].token_hash,signed.token);
  assert.equal(context.authenticate_(signed.token,true).role,'owner');
  assert.throws(()=>context.verifyCode_({email:'owner@example.test',code}),/expired/);
  context.logout_(signed.token);assert.throws(()=>context.authenticate_(signed.token,true),/expired/);
  assert.ok(db.Login_Logs.some(r=>r.logout_time));
});
test('Customer cannot promote self or read dashboard',()=>{
  context.requestCode_({email:'customer@example.test'});const code=lastMail.body.match(/\d{8}/)[0];
  const signed=context.verifyCode_({email:'customer@example.test',code,role:'owner',session_id:'test'});
  assert.equal(signed.user.role,'customer');assert.throws(()=>context.dashboard_(context.authenticate_(signed.token,true),{}),/Owner access/);
  assert.throws(()=>context.authenticate_('',true),/sign in/);
});
test('Expired OTP, attempt limit and disabled users fail closed',()=>{
  context.requestCode_({email:'expired@example.test'});db._AuthCodes.find(r=>r.email==='expired@example.test').expires_at=0;
  assert.throws(()=>context.verifyCode_({email:'expired@example.test',code:'12345678'}),/expired/);
  const row=db._AuthCodes.find(r=>r.email==='expired@example.test');row.expires_at=Date.now()+100000;row.attempts=5;
  assert.throws(()=>context.verifyCode_({email:'expired@example.test',code:'12345678'}),/attempt limit/);
  context.requestCode_({email:'customer@example.test'});db.Users.find(r=>r.email==='customer@example.test').status='disabled';
  assert.throws(()=>context.verifyCode_({email:'customer@example.test',code:lastMail.body.match(/\d{8}/)[0]}),/not active/);
});
test('Unknown API operation cannot expose inventory or logs',()=>{
  context.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};
  context.ContentService={MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>JSON.parse(text)})};
  for(const action of ['getProducts','Users','logs','syncChatbotView']){const r=context.doPost({postData:{contents:JSON.stringify({action,session_id:'test'})}});assert.equal(r.success,false);assert.equal(r.message,'Unknown action.');}
});
test('Chat rate window expires even while requests continue',()=>{
  let cached=null,ttl=0;
  context.CacheService={getScriptCache:()=>({get:()=>cached,put:(_,v,t)=>{cached=v;ttl=t;}})};
  context.chatRate_('audit');const initial=JSON.parse(cached).until;
  for(let i=1;i<20;i++)context.chatRate_('audit');
  assert.equal(JSON.parse(cached).until,initial);assert.throws(()=>context.chatRate_('audit'),/wait a minute/);
  cached=JSON.stringify({count:20,until:Date.now()-1});context.chatRate_('audit');assert.equal(JSON.parse(cached).count,1);assert.ok(ttl<=60);
});
test('Public deals read branch data once without taking the write lock',()=>{
  let calls=0,locks=0;context.DataService.getBranches=()=>{calls++;return branches;};context.DataService.getDeals=()=>deals;
  context.LockService={getScriptLock:()=>({waitLock(){locks++;},releaseLock(){}})};
  const result=context.doPost({postData:{contents:JSON.stringify({action:'deals',session_id:'audit'})}});
  assert.equal(result.success,true);assert.equal(calls,1);assert.equal(locks,0);
});
test('Contact helpers tolerate numeric cells and reject placeholder destinations',async()=>{
  const source=fs.readFileSync(path.join(root,'assets/js/dom.js'),'utf8');
  const dom=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(dom.telephoneUrl(3038163840),'');
  assert.equal(dom.telephoneUrl('+971 (50) 123-4567'),'tel:+971501234567');
  assert.equal(dom.whatsappUrl('https://wa.me/971XXXXXXXXX'),'');
  assert.equal(dom.whatsappUrl('https://wa.me/971501234567'),'https://wa.me/971501234567');
  assert.equal(dom.safeUrl('Google Maps link'),'');assert.equal(dom.safeUrl('javascript:alert(1)'),'');
});
