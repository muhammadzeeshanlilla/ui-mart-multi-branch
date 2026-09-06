const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {fixture}=require('./auth-fixture.cjs');
test('Password length is 5–128 with no character-class requirements',()=>{
 const {c}=fixture();
 for(const password of ['abcde','12345','abc12','mart1','ABCDE','!!!!!','x'.repeat(128)])assert.equal(c.password_(password),password);
 for(const password of ['','abcd','1234','x'.repeat(129),null,12345])assert.throws(()=>c.password_(password),/between 5 and 128/);
});
test('PBKDF2 SHA256 at full work factor matches Node crypto',()=>{
 const {c}=fixture();const start=Date.now();
 assert.equal(c.derivePassword_('A test passphrase 🔐','fixed-vector-salt',600000),crypto.pbkdf2Sync('A test passphrase 🔐','fixed-vector-salt',600000,32,'sha256').toString('hex'));
 console.log('Local PBKDF2 benchmark ms:',Date.now()-start);
});
test('Customer signup verifies only; password login, private routes, logging, contact and revocation',()=>{
 const {call,db,mail,otp}=fixture(),password='Long unique test passphrase!',email='customer@example.test';
 assert.equal(call('requestCode',{name:'Customer',email:' CUSTOMER@example.test ',password}).success,true);
 assert.equal(db.Users.length,0);assert.equal(db._AuthCodes[0].password_hash.length,64);
 assert.ok(!JSON.stringify(db).includes(password));
 const code=otp();assert.equal(call('verifyCode',{email,code:code==='00000000'?'11111111':'00000000'}).success,false);
 const verified=call('verifyCode',{email,code});assert.equal(verified.success,true);assert.equal(verified.token,undefined);assert.equal(db._Sessions.length,0);
 assert.equal(db.Users.length,1);assert.equal(db.Users[0].email_verified,true);assert.equal(call('verifyCode',{email,code}).success,false);
 assert.equal(call('login',{email,password:'An incorrect passphrase'}).success,false);
 const login=call('login',{email,password,role:'owner'});assert.equal(login.success,true);assert.equal(login.user.role,'customer');assert.ok(login.token);
 assert.ok(db.Users[0].last_login);assert.equal(mail.length,1,'normal login sends no OTP');
 assert.doesNotMatch(JSON.stringify(login),/password_hash|password_salt|AUTH_SECRET/);
 const token=login.token;assert.equal(call('dashboard',{token,role:'owner'}).success,false);
 for(const action of ['branches','deals','chat','contact','me','dashboard'])assert.equal(call(action,{message:'Hello',subject:'Hi'}).code,'AUTH_REQUIRED');
 assert.equal(call('chat',{token,message:'Hello'}).success,true);assert.equal(db.Chat_Logs.length,1);assert.equal(db.Chat_Logs[0].user_id,login.user.user_id);
 assert.equal(call('contact',{token,subject:'Question',message:'Please contact me',email:'attacker@example.test',to:'attacker@example.test'}).success,true);
 assert.equal(mail.at(-1).to,'owner@example.test');assert.equal(mail.at(-1).replyTo,email);assert.ok(mail.at(-1).body.includes(login.user.user_id));
 assert.equal(call('contact',{token,subject:'bad\nheader',message:'test'}).success,false);
 assert.equal(call('contact',{token,subject:'Hi',message:'x'.repeat(4001)}).success,false);
 assert.equal(db.Activity_Logs.filter(r=>r.action==='CONTACT').length,1);
 assert.equal(call('logout',{token}).success,true);assert.equal(call('me',{token}).code,'AUTH_REQUIRED');assert.equal(call('dashboard',{token}).code,'AUTH_REQUIRED');
 assert.ok(db.Login_Logs.find(r=>r.status==='success').logout_time);assert.equal(db.Login_Logs.filter(r=>r.status==='failed').length,1);
});
test('Existing owner setup preserves identity and history; credential columns never reach dashboard',()=>{
 const {call,db,otp}=fixture(),password='Another very long passphrase';
 db.Users.push({user_id:'existing-owner',name:'Old',email:'owner@example.test',role:'owner',status:'active',created_at:'2025-01-01'});
 assert.equal(call('requestCode',{email:'owner@example.test',name:'Owner',password}).success,true);
 assert.equal(call('verifyCode',{email:'owner@example.test',code:otp()}).success,true);
 assert.equal(db.Users.length,1);assert.equal(db.Users[0].user_id,'existing-owner');
 const login=call('login',{email:'owner@example.test',password});assert.equal(login.user.role,'owner');
 db.Users[0].AUTH_SECRET='malicious-extra-column';
 const dashboard=call('dashboard',{token:login.token,tab:'users'});assert.equal(dashboard.success,true);
 assert.doesNotMatch(JSON.stringify(dashboard),/password_hash|password_salt|password_iterations|AUTH_SECRET|malicious-extra/);
 db.Users[0].status='disabled';assert.equal(call('me',{token:login.token}).code,'AUTH_REQUIRED');
});
test('Expired signup codes, limited attempts and old OTP-only sessions are rejected',()=>{
 const {call,db,c}=fixture();
 db._AuthCodes.push({email:'expired@example.test',purpose:'signup',password_hash:'hash',expires_at:Date.now()-1,attempts:0});
 assert.equal(call('verifyCode',{email:'expired@example.test',code:'12345678'}).success,false);
 db._AuthCodes[0].expires_at=Date.now()+60000;db._AuthCodes[0].attempts=5;
 assert.equal(call('verifyCode',{email:'expired@example.test',code:'12345678'}).success,false);
 db.Users.push({user_id:'old',email:'old@example.test',status:'active'});db._Sessions.push({token_hash:c.hash_('old-token'),user_id:'old',expires_at:Date.now()+60000,revoked:false});
 assert.equal(call('me',{token:'old-token'}).code,'AUTH_REQUIRED');
});
