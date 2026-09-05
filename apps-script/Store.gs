/** Sheet adapter. Domain code uses named records, never column positions. */
var Schema = {
  AbuDhabi_Products:['product_id','product_name','category','description','price','quantity','brand','unit','keywords','is_active'],
  Dubai_Products:['product_id','product_name','category','description','price','quantity','brand','unit','keywords','is_active'],
  Sharjah_Products:['product_id','product_name','category','description','price','quantity','brand','unit','keywords','is_active'],
  Chatbot_View:['product_id','product_name','category','branch','description','price','quantity','stock_status','brand','unit','keywords','is_active'],
  Deals:['deal_id','title','branch','category','product_id','description','discount_type','discount_value','free_item','start_date','end_date','image_url','is_active'],
  Branches:['branch_id','branch_name','city','specialization','address','phone','whatsapp','email','map_url','opening_hours','description','is_active'],
  Users:['user_id','name','email','role','status','created_at'],
  Login_Logs:['log_id','user_id','user_email','login_time','logout_time','status','session_id'],
  Chat_Logs:['chat_id','session_id','user_id','user_name','user_message','bot_response','detected_intent','detected_branch','detected_category','detected_product','timestamp'],
  Activity_Logs:['activity_id','user_id','session_id','action','description','timestamp'],
  _AuthCodes:['email','code_hash','expires_at','attempts','sent_at'],
  _Sessions:['token_hash','user_id','session_id','expires_at','revoked'],
};
function setting_(key){return PropertiesService.getScriptProperties().getProperty(key)||'';}
function book_(){const id=setting_('SPREADSHEET_ID');if(!id)throw new Error('SETUP_REQUIRED');return SpreadsheetApp.openById(id);}
function sheet_(name){if(!Schema[name])throw new Error('INVALID_SHEET');const sheet=book_().getSheetByName(name);if(!sheet)throw new Error('SETUP_REQUIRED');return sheet;}
function headers_(sheet){return sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);}
function value_(v){return v instanceof Date?Utilities.formatDate(v,'Asia/Dubai','yyyy-MM-dd\'T\'HH:mm:ssXXX'):v;}
function rows_(name){
  const sheet=sheet_(name);if(sheet.getLastRow()<2)return[];
  const headers=headers_(sheet);
  return sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues().filter(row=>row.some(v=>v!=='')).map(row=>{const obj={};headers.forEach((key,i)=>obj[key]=value_(row[i]));return obj;});
}
function cell_(value){
  if(value===undefined||value===null)return'';
  // User-controlled messages/names must never become spreadsheet formulas.
  if(typeof value==='string'&&/^[\s]*[=+@-]/.test(value))return"'"+value;
  return value;
}
function append_(name,record){const sheet=sheet_(name);sheet.appendRow(headers_(sheet).map(key=>cell_(record[key])));}
function update_(name,key,value,patch){
  const sheet=sheet_(name),headers=headers_(sheet),index=headers.indexOf(key);if(index<0)throw new Error('SCHEMA_ERROR');
  if(sheet.getLastRow()<2)return false;
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
  const offset=values.findIndex(row=>String(row[index])===String(value));if(offset<0)return false;
  const row=values[offset];headers.forEach((h,i)=>{if(Object.prototype.hasOwnProperty.call(patch,h))row[i]=cell_(patch[h]);});
  sheet.getRange(offset+2,1,1,headers.length).setValues([row]);return true;
}
function setup(){
  const book=book_();
  Object.keys(Schema).forEach(name=>{
    let sheet=book.getSheetByName(name);if(!sheet)sheet=book.insertSheet(name);
    if(sheet.getLastRow()===0){sheet.getRange(1,1,1,Schema[name].length).setValues([Schema[name]]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,Schema[name].length).setBackground('#174a3d').setFontColor('#ffffff').setFontWeight('bold');}
    else if(!Schema[name].every(h=>headers_(sheet).includes(h)))throw new Error('Missing columns in '+name+'; compare with Schema before proceeding.');
    if(name.startsWith('_'))sheet.hideSheet();
  });
  if(!setting_('AUTH_SECRET'))PropertiesService.getScriptProperties().setProperty('AUTH_SECRET',Utilities.getUuid()+Utilities.getUuid());
  if(!rows_('Branches').length){
    [['AD','Abu Dhabi','Electronics & Kitchen Items'],['DU','Dubai','Furniture & Kitchen Items'],['SH','Sharjah','Hardware, Pipes & Kitchen Items']].forEach(row=>append_('Branches',{branch_id:row[0],branch_name:'U&I Mart '+row[1],city:row[1],specialization:row[2],is_active:true}));
  }
  syncChatbotView();
}
function syncChatbotView(){const lock=LockService.getScriptLock();lock.waitLock(20000);try{syncView_();}finally{lock.releaseLock();}}
function syncView_(){
  const combined=[];const seen={};
  [['AbuDhabi_Products','Abu Dhabi'],['Dubai_Products','Dubai'],['Sharjah_Products','Sharjah']].forEach(([tab,branch])=>{
    rows_(tab).forEach(p=>{
      if(!p.product_id||!p.product_name)return;
      const key=branch+':'+p.product_id;if(seen[key])throw new Error('Duplicate product ID in '+tab);seen[key]=true;
      const validPrice=p.price===''||(Number.isFinite(Number(p.price))&&Number(p.price)>=0);
      const validQty=p.quantity===''||(Number.isInteger(Number(p.quantity))&&Number(p.quantity)>=0);
      const allowed=branch==='Abu Dhabi'?['Electronics','Kitchen Items']:branch==='Dubai'?['Furniture','Kitchen Items']:['Pipes','Hardware','Utility products','Kitchen Items'];
      if(!validPrice||!validQty||!allowed.includes(p.category))throw new Error('Invalid price, quantity or category in '+tab+': '+p.product_id);
      combined.push(Object.assign({},p,{branch,stock_status:p.quantity===''?'unknown':Number(p.quantity)>0?'in_stock':'out_of_stock'}));
    });
  });
  const sheet=sheet_('Chatbot_View'),headers=headers_(sheet);
  if(sheet.getLastRow()>1)sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).clearContent();
  if(combined.length)sheet.getRange(2,1,combined.length,headers.length).setValues(combined.map(row=>headers.map(h=>cell_(row[h]))));
  PropertiesService.getScriptProperties().setProperty('VIEW_SYNC_AT',String(Date.now()));
}
function onBranchEdit(e){if(e&&e.range&&/^(AbuDhabi|Dubai|Sharjah)_Products$/.test(e.range.getSheet().getName()))syncChatbotView();}
function installTriggers(){
  const existing=ScriptApp.getProjectTriggers();
  if(!existing.some(t=>t.getHandlerFunction()==='onBranchEdit'))ScriptApp.newTrigger('onBranchEdit').forSpreadsheet(book_()).onEdit().create();
  if(!existing.some(t=>t.getHandlerFunction()==='syncChatbotView'))ScriptApp.newTrigger('syncChatbotView').timeBased().everyMinutes(5).create();
  if(!existing.some(t=>t.getHandlerFunction()==='cleanupPrivateRecords'))ScriptApp.newTrigger('cleanupPrivateRecords').timeBased().everyDays(1).create();
}
var DataService={
  getProducts:function(){if(Date.now()-Number(setting_('VIEW_SYNC_AT'))>300000)syncView_();return rows_('Chatbot_View');},
  getDeals:function(){return ChatEngine.activeDeals(rows_('Deals'));},
  getBranches:function(){return rows_('Branches').filter(b=>ChatEngine.active(b.is_active));},
  saveChatLog:function(record){append_('Chat_Logs',record);},
  saveLoginLog:function(record){append_('Login_Logs',record);},
  saveActivityLog:function(record){append_('Activity_Logs',record);},
};
