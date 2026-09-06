function activity_(user,session,action,description){DataService.saveActivityLog({activity_id:id_(),user_id:user?user.user_id:'',session_id:session,action,description,timestamp:now_()});}
function dashboard_(user,payload){
  if(!user||user.role!=='owner')throw new Error('Owner access is required.');
  const sources={users:'Users',logins:'Login_Logs',chats:'Chat_Logs',activities:'Activity_Logs',deals:'Deals',branches:'Branches'};
  const tab=String(payload.tab||'chats');if(!sources[tab])throw new Error('Invalid dashboard section.');
  const offset=Number(payload.offset||0);if(!Number.isInteger(offset)||offset<0||offset>1000000)throw new Error('Invalid page.');
  if(offset===0)activity_(user,user.auth_session,'DASHBOARD_VIEW','Viewed '+tab);
  const all=rows_(sources[tab]).reverse(),limit=25;
  const activeBranches=DataService.getBranches();
  const safeRows=all.slice(offset,offset+limit).map(row=>Object.fromEntries(Schema[sources[tab]].filter(key=>!/^password_/.test(key)).map(key=>[key,row[key]])));
  return{success:true,tab,rows:safeRows,total:all.length,offset,limit,summary:{users:rows_('Users').length,logins:rows_('Login_Logs').filter(l=>l.status==='success').length,chats:rows_('Chat_Logs').length,deals:DataService.getDeals().filter(d=>activeBranches.some(b=>b.city===d.branch)).length}};
}
function contact_(user,payload){
 const subject=typeof payload.subject==='string'?payload.subject.trim():'',message=typeof payload.message==='string'?payload.message.trim():'';
 if(!subject||subject.length>150||/[\r\n\x00-\x1f]/.test(subject))throw new Error('Enter a subject between 1 and 150 characters.');
 if(!message||message.length>4000||/\x00/.test(message))throw new Error('Enter a message between 1 and 4000 characters.');
 rate_('contact:'+user.user_id,3,600);rate_('contact-global',50,86400);
 const recipients=setting_('OWNER_EMAILS').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean).map(email_);if(!recipients.length)throw new Error('CONTACT_CONFIG_ERROR');
 MailApp.sendEmail({to:recipients.join(','),replyTo:user.email,name:'U&I Mart',subject:'U&I Mart Contact Message — '+String(user.name).replace(/[\r\n]/g,' '),body:'Name: '+user.name+'\nEmail: '+user.email+'\nUser ID: '+user.user_id+'\nDate: '+now_()+'\nSubject: '+subject+'\n\n'+message});
 activity_(user,user.auth_session,'CONTACT','Sent a contact message to the owner');
 return{success:true,message:'Your message has been sent successfully.'};
}
