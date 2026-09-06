const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require('../.tools/playwright/driver/package');const {fixture}=require('./auth-fixture.cjs');
test('Real frontend + Apps Script adapter: signup, roles, gate, caching, contact and keyboard layouts',async()=>{
 const backend=fixture();
 backend.db.Branches.push(...['AD','DU','SH'].map((branch_id,i)=>({branch_id,city:['Abu Dhabi','Dubai','Sharjah'][i],branch_name:'Branch '+branch_id,specialization:['Electronics','Furniture','Hardware'][i],description:'Sheet description',is_active:true,phone:'+971501234567',email:'branch@example.test',address:'Sheet address',opening_hours:'9 AM – 10 PM'})));
 backend.db.Deals.push({deal_id:'D1',branch:'Dubai',category:'Furniture',title:'Furniture offer',description:'Selected sofas',discount_type:'percentage',discount_value:10,is_active:true,start_date:'2020-01-01',end_date:'2030-01-01'});
 backend.c.DataService.getProducts=()=>[{product_id:'P1',product_name:'Sofa',category:'Furniture',branch:'Dubai',price:1200,quantity:4,is_active:true}];
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const root=path.resolve(__dirname,'..'),base='http://localhost/ui-mart-multi-branch/';
 const errors=[],calls=[];let delayBranches=0;
 try{
 const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await context.route('https://**',route=>route.abort());
 await context.route(base+'**',route=>{
  const name=new URL(route.request().url()).pathname.replace('/ui-mart-multi-branch/','')||'index.html';
  if(name==='assets/js/config.js')return route.fulfill({contentType:'text/javascript',body:"export const config={preview:false,apiUrl:'https://script.google.com/macros/s/test/exec',timeoutMs:10000};"});
  return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(path.join(root,name))});
 });
 await context.route('https://script.google.com/**',async route=>{
  const payload=route.request().postDataJSON();calls.push(payload.action);
  const data=backend.call(payload.action,payload);
  if(payload.action==='branches'&&delayBranches)await new Promise(r=>setTimeout(r,delayBranches));
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(base);await page.waitForURL('**/pages/login.html');await page.waitForSelector('#signup-form:visible');
 assert.equal(await page.locator('.hero').count(),0);
 async function signup(email,name){
  await page.locator('#show-signup').click();await page.locator('#name').fill(name);await page.locator('#signup-email').fill(email);
  await page.locator('#signup-password').fill('Browser test passphrase long!');await page.locator('#confirm-password').fill('Browser test passphrase long!');
  await page.locator('#signup-form button').click();await page.waitForSelector('#code-form:visible',{timeout:120000});
  assert.equal(await page.locator('#signup-password').inputValue(),'');
  await page.locator('#code').fill(backend.otp());await page.locator('#code-form button[type=submit]').click();await page.waitForSelector('#login-form:visible');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ui_auth')),null);
 }
 async function login(email){await page.locator('#email').fill(email);await page.locator('#password').fill('Browser test passphrase long!');await page.locator('#login-form button').click();await page.waitForURL('**/index.html',{timeout:120000});await page.waitForSelector('.hero');}
 await signup('customer@example.test','Customer Name');delayBranches=1500;await login('customer@example.test');
 assert.ok(await page.locator('header .account-menu').isVisible());assert.equal(await page.locator('a.login-link').count(),0);
 assert.equal(await page.locator('.account-panel a').count(),0);
 await page.waitForSelector('.deal-card');await page.waitForFunction(()=>document.querySelector('#branch-cards').textContent.includes('Sheet description'));
 const branchCalls=calls.filter(a=>a==='branches').length;
 await page.evaluate(async()=>{const {sharedData}=await import('./assets/js/shared-data.js');await Promise.all([sharedData('branches'),sharedData('branches')]);});
 assert.equal(calls.filter(a=>a==='branches').length-branchCalls,1,'duplicate shared reads coalesce');
 await page.locator('#uiChatLauncher').click();await page.waitForSelector('#uiChatInput:visible');await page.locator('#uiChatInput').fill('Sofa price');await page.locator('#uiChatSend').click();await page.waitForSelector('.ui-chat-product-price');assert.match(await page.locator('.ui-chat-product-price').innerText(),/AED/);
 for(const width of [430,390,375,360]){
  await page.setViewportSize({width,height:800});
  for(const height of [800,330]){
   await page.setViewportSize({width,height});await page.waitForTimeout(80);
   const box=await page.locator('#uiChatPanel').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height+1,`panel outside viewport ${width}/${height}`);
   assert.ok(await page.locator('#uiChatClose').isVisible());assert.ok(await page.locator('#uiChatSend').isVisible());
   assert.equal(await page.evaluate(()=>document.body.style.position),'fixed');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  }
 }
 await page.setViewportSize({width:390,height:800});
 await page.evaluate(()=>{window.originalViewport=window.visualViewport;Object.defineProperty(window,'visualViewport',{configurable:true,value:{height:330,offsetTop:100}});window.dispatchEvent(new Event('resize'));});
 const shifted=await page.locator('#uiChatPanel').boundingBox();assert.ok(shifted.y>=100&&shifted.y+shifted.height<=430,'visual viewport offset respected');
 await page.evaluate(()=>{Object.defineProperty(window,'visualViewport',{configurable:true,value:window.originalViewport});window.dispatchEvent(new Event('resize'));});
 await page.locator('#uiChatClose').click();assert.notEqual(await page.evaluate(()=>document.body.style.position),'fixed');
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(base+'pages/dubai.html');await page.waitForSelector('.hero');assert.match(await page.locator('main').innerText(),/Sheet description/);
 await page.goto(base+'pages/contact.html');await page.waitForSelector('#contact-form');assert.match(await page.locator('#contact-identity').innerText(),/Customer Name.*customer@example.test/);
 await page.locator('#subject').fill('Question');await page.locator('#contact-message').fill('Please help');await page.locator('#contact-form button').click();await page.waitForFunction(()=>document.querySelector('#contact-status').textContent.includes('successfully'));
 assert.equal(backend.mail.at(-1).replyTo,'customer@example.test');
 await page.evaluate(()=>{const a=JSON.parse(sessionStorage.getItem('ui_auth'));a.user.role='owner';sessionStorage.setItem('ui_auth',JSON.stringify(a));});
 await page.goto(base+'pages/owner-dashboard.html');await page.waitForSelector('.dashboard-message');assert.equal(await page.locator('.record').count(),0);
 await page.locator('.account-menu summary').click();await page.locator('.account-panel button').click();await page.waitForURL('**/pages/login.html');
 await signup('owner@example.test','Owner Name');await login('owner@example.test');
 await page.locator('.account-menu summary').click();await page.getByRole('link',{name:'Owner Dashboard',exact:true}).click();await page.waitForSelector('.record');
 await page.locator('[data-tab="users"]').click();await page.waitForFunction(()=>document.querySelector('#dashboard-status').textContent.startsWith('Updated'));
 assert.doesNotMatch(await page.locator('#records').innerText(),/password hash|password salt/);
 for(const width of [430,390,375,360,768,1024,1440]){await page.setViewportSize({width,height:800});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 const token=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('ui_auth')).token);
 await page.locator('#logout').click();await page.waitForURL('**/pages/login.html');assert.equal(backend.call('dashboard',{token}).code,'AUTH_REQUIRED');
 await page.goto(base+'pages/sharjah.html');await page.waitForURL('**/pages/login.html');assert.equal(await page.locator('.hero').count(),0);
 assert.deepEqual(errors,[]);assert.equal(backend.db.Users.length,2);
 console.log('Frontend/backend contract checks passed; external mail and real Android keyboard remain deployment/device checks.');
 }finally{await browser.close();}
});
