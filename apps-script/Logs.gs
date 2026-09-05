function activity_(user,session,action,description){DataService.saveActivityLog({activity_id:id_(),user_id:user?user.user_id:'',session_id:session,action,description,timestamp:now_()});}
function dashboard_(user,payload){
  if(!user||user.role!=='owner')throw new Error('Owner access is required.');
  const sources={users:'Users',logins:'Login_Logs',chats:'Chat_Logs',activities:'Activity_Logs',deals:'Deals',branches:'Branches'};
  const tab=String(payload.tab||'chats');if(!sources[tab])throw new Error('Invalid dashboard section.');
  const offset=Number(payload.offset||0);if(!Number.isInteger(offset)||offset<0||offset>1000000)throw new Error('Invalid page.');
  const all=rows_(sources[tab]).reverse(),limit=25;
  if(offset===0)activity_(user,user.auth_session,'DASHBOARD_VIEW','Viewed '+tab);
  return{success:true,tab,rows:all.slice(offset,offset+limit),total:all.length,offset,limit,summary:{users:rows_('Users').length,logins:rows_('Login_Logs').filter(l=>l.status==='success').length,chats:rows_('Chat_Logs').length,deals:DataService.getDeals().length}};
}
