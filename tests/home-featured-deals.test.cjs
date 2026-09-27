const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('../.tools/playwright/driver/package');
const {fixture}=require('./auth-fixture.cjs');

test('Home renders the highest active percentage deal for each branch before U&I Difference',async()=>{
  const backend=fixture(),token='featured-deals-token',now=Date.now(),calls=[];
  backend.db.Users.push({user_id:'FD-U1',name:'Featured Customer',email:'featured@example.test',role:'customer',status:'active',email_verified:true,password_hash:'hash'});
  backend.db._Sessions.push({token_hash:backend.c.hash_(token),user_id:'FD-U1',session_id:'featured-session',expires_at:now+3600000,revoked:false});
  backend.db.Branches.push(...[
    ['AD','Abu Dhabi','Electronics & Kitchen Items'],['DU','Dubai','Furniture & Kitchen Items'],['SH','Sharjah','Hardware, Pipes & Kitchen Items'],
  ].map(([branch_id,city,specialization])=>({branch_id,city,branch_name:'U&I Mart '+city,specialization,description:'Branch details',is_active:true})));
  const deal=(deal_id,branch,title,discount_value,extra={})=>({deal_id,branch,title,description:title+' description',category:'Kitchen Items',discount_type:'percentage',discount_value,start_date:'2020-01-01',end_date:'2030-12-31',is_active:true,...extra});
  backend.db.Deals.push(
    deal('AD8','Abu Dhabi','Refrigerator Special',8),deal('AD10','Abu Dhabi','Electronics Weekend Offer',10),
    deal('DU9','Dubai','Dining Offer',9),deal('DU12','Dubai','Bedroom Furniture Offer',12),
    deal('SH10','Sharjah','Hardware Tools Offer',10),deal('SH15','Sharjah','Pipe Bulk Deal',15),
    deal('AD50','Abu Dhabi','Inactive Offer',50,{is_active:false}),
    deal('DU40','Dubai','Expired Offer',40,{end_date:'2020-01-02'}),
    {...deal('SH99','Sharjah','Fixed Price Offer',99),discount_type:'fixed'}
  );
  const browser=await chromium.launch({channel:'msedge',headless:true}),root=path.resolve(__dirname,'..'),base='http://localhost/ui-mart-multi-branch/',errors=[];
  try{
    const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await context.addInitScript(({token})=>{sessionStorage.setItem('ui_auth',JSON.stringify({token,user:{user_id:'FD-U1',name:'Featured Customer',email:'featured@example.test',role:'customer'}}));sessionStorage.setItem('ui_auth_validated_at',String(Date.now()));},{token});
    await context.route('https://**',route=>route.abort());
    await context.route(base+'**',route=>{const name=new URL(route.request().url()).pathname.replace('/ui-mart-multi-branch/','')||'index.html';if(name==='assets/js/config.js')return route.fulfill({contentType:'text/javascript',body:"export const config={preview:false,apiUrl:'https://script.google.com/macros/s/test/exec',timeoutMs:10000};"});return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(path.join(root,name))});});
    await context.route('https://script.google.com/**',route=>{const payload=route.request().postDataJSON();calls.push(payload.action);route.fulfill({contentType:'application/json',body:JSON.stringify(backend.call(payload.action,payload))});});
    await page.goto(base);await page.waitForSelector('#featured-deals-list .deal-card:nth-child(3)');
    const cards=page.locator('#featured-deals-list .deal-card');assert.equal(await cards.count(),3);
    assert.deepEqual(await cards.locator('.tag').allTextContents(),['Abu Dhabi','Dubai','Sharjah']);
    assert.deepEqual(await cards.locator('h3').allTextContents(),['Electronics Weekend Offer','Bedroom Furniture Offer','Pipe Bulk Deal']);
    assert.deepEqual(await cards.locator('.featured-discount').allTextContents(),['10% off','12% off','15% off']);
    assert.equal(calls.filter(action=>action==='deals').length,1,'Home should reuse one Deals request');
    assert.equal(await page.locator('a.text-link').getAttribute('href'),'pages/deals.html');
    assert.ok(await page.evaluate(()=>document.querySelector('#featured-deals-list').closest('section').compareDocumentPosition(document.querySelector('.soft-section'))&Node.DOCUMENT_POSITION_FOLLOWING));
    for(const size of [{width:1440,height:900},{width:900,height:900},{width:390,height:844}]){await page.setViewportSize(size);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await page.locator('a.text-link').click();await page.waitForURL('**/pages/deals.html');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
