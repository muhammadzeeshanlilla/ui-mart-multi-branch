const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function fixture(){
 const db={},props={AUTH_SECRET:'local-test-secret',OWNER_EMAILS:'owner@example.test'},mail=[];
 const c=vm.createContext({Date,console:{error(){}}});
 for(const file of ['PasswordCrypto','Chatbot','Store','Auth','Logs','Code'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../apps-script/'+file+'.gs'),'utf8'),c);
 Object.keys(c.Schema).forEach(k=>db[k]=[]);
 c.rows_=name=>db[name].map(r=>({...r}));c.append_=(name,row)=>db[name].push({...row});
 c.update_=(name,key,value,patch)=>{const r=db[name].find(r=>r[key]===value);if(!r)return false;Object.assign(r,patch);return true;};
 c.PropertiesService={getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v})};
 c.Utilities={getUuid:()=>crypto.randomUUID(),computeHmacSha256Signature:(v,k)=>crypto.createHmac('sha256',k).update(v).digest(),base64EncodeWebSafe:v=>Buffer.from(v).toString('base64url'),computeDigest:(_,v)=>Array.from(crypto.createHash('sha256').update(v).digest()),DigestAlgorithm:{SHA_256:'SHA256'}};
 c.MailApp={sendEmail:m=>mail.push(m)};c.LockService={getScriptLock:()=>({waitLock(){},releaseLock(){}})};c.chatRate_=()=>{};
 c.ContentService={MimeType:{JSON:'json'},createTextOutput:s=>({setMimeType:()=>JSON.parse(s)})};
 c.DataService.getProducts=()=>[];
 const call=(action,payload={})=>c.doPost({postData:{contents:JSON.stringify({action,session_id:'test-session',...payload})}});
 const otp=()=>mail.at(-1).body.match(/\b\d{8}\b/)[0];
 return {c,db,props,mail,call,otp};
}

module.exports={fixture};
