const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('../../.tools/playwright/driver/package');
const {fixture}=require('../../tests/auth-fixture.cjs');

test('rendered authenticated Home AI assistant is isolated, responsive, and session gated',async()=>{
  const backend=fixture(),token='browser-ai-token',now=Date.now();
  backend.props.AI_PROVIDER='openai-compatible';backend.props.AI_API_URL='https://provider.example.test/chat';backend.props.AI_API_KEY='test-secret';backend.props.AI_MODEL='test-model';
  backend.db.Users.push({user_id:'AI-U1',name:'Muhammad Customer',email:'customer@example.test',role:'customer',status:'active',email_verified:true,password_hash:'hash',created_at:new Date(now).toISOString()});
  backend.db._Sessions.push({token_hash:backend.c.hash_(token),user_id:'AI-U1',session_id:'trusted-auth-session',expires_at:now+3600000,revoked:false});
  backend.db.Branches.push({branch_id:'DU',branch_name:'U&I Mart Dubai',city:'Dubai',specialization:'Furniture & Kitchen Items',address:'Dubai address',opening_hours:'9 AM – 9 PM',is_active:true},{branch_id:'AD',branch_name:'U&I Mart Abu Dhabi',city:'Abu Dhabi',specialization:'Electronics & Kitchen Items',address:'Abu Dhabi address',opening_hours:'9 AM – 9 PM',is_active:true},{branch_id:'SH',branch_name:'U&I Mart Sharjah',city:'Sharjah',specialization:'Hardware, Pipes & Kitchen Items',address:'Sharjah address',opening_hours:'9 AM – 9 PM',is_active:true});
  backend.c.DataService.getProducts=()=>[{product_id:'SOFA1',product_name:'Compact Sofa',category:'Furniture',branch:'Dubai',description:'Small apartment sofa',price:1800,quantity:3,brand:'U&I',keywords:'sofa apartment',is_active:true},{product_id:'SOFA2',product_name:'Large Sofa',category:'Furniture',branch:'Dubai',description:'Large sofa',price:3200,quantity:1,brand:'U&I',keywords:'sofa',is_active:true},{product_id:'TV1',product_name:'Samsung 55 Inch TV',category:'Electronics',branch:'Abu Dhabi',description:'Samsung television',price:1799,quantity:10,brand:'Samsung',keywords:'samsung tv television 55 inch',is_active:true}];
  backend.db.Deals.push({deal_id:'D1',title:'Furniture offer',branch:'Dubai',category:'Furniture',description:'Current saving',is_active:true,start_date:'2020-01-01',end_date:'2030-01-01'});
  const memory=new Map();backend.c.CacheService={getScriptCache:()=>({get:key=>memory.get(key)||null,put:(key,value)=>memory.set(key,value)})};backend.c.rate_=()=>{};
  backend.c.UrlFetchApp={fetch:(url,options)=>{const body=JSON.parse(options.payload),prompt=body.messages.at(-1).content;const content=/Samsung 55 inch TV/i.test(prompt)?'**Samsung 55 Inch TV** is available for AED 1799.':'I found the matching trusted U&I information.';return{getResponseCode:()=>200,getContentText:()=>JSON.stringify({choices:[{message:{content}}]})};}};
  const browser=await chromium.launch({channel:'msedge',headless:true});const root=path.resolve(__dirname,'../..'),base='http://localhost/ui-mart-multi-branch/';const errors=[];
  try{
    const context=await browser.newContext();const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await context.addInitScript(({token})=>{sessionStorage.setItem('ui_auth',JSON.stringify({token,user:{user_id:'AI-U1',name:'Muhammad Customer',email:'customer@example.test',role:'customer'}}));sessionStorage.setItem('ui_auth_validated_at',String(Date.now()));},{token});
    await context.route('https://**',route=>route.abort());
    await context.route(base+'**',route=>{const name=new URL(route.request().url()).pathname.replace('/ui-mart-multi-branch/','')||'index.html';if(name==='assets/js/config.js')return route.fulfill({contentType:'text/javascript',body:"export const config={preview:false,apiUrl:'https://script.google.com/macros/s/test/exec',timeoutMs:10000};"});return route.fulfill({contentType:name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.svg')?'image/svg+xml':'text/html',body:fs.readFileSync(path.join(root,name))});});
    await context.route('https://script.google.com/**',route=>{const payload=route.request().postDataJSON();route.fulfill({contentType:'application/json',body:JSON.stringify(backend.call(payload.action,payload))});});
    await page.goto(base);await page.waitForSelector('.ai-launcher:visible');assert.equal(await page.locator('#uiChatbot').count(),0,'old Rule-Based chatbot must not be on Home');
    await page.locator('.ai-launcher').click();await page.waitForSelector('.ai-panel.is-open');assert.match(await page.locator('.ai-messages').innerText(),/Hi Muhammad/);
    async function ask(message){const before=await page.locator('.ai-message.is-assistant').count();await page.locator('#aiAssistantInput').fill(message);await page.locator('.ai-form button').click();await page.waitForFunction(count=>document.querySelectorAll('.ai-message.is-assistant').length>count&&!document.querySelector('.ai-bubble.is-thinking')&&!document.querySelector('#aiAssistantInput').disabled,before);}
    await ask('I need furniture under AED 2500.');assert.match(await page.locator('.ai-product').last().innerText(),/Compact Sofa.*AED/s);
    await ask('What deals are available in Dubai?');assert.match(await page.locator('.ai-deal').last().innerText(),/Dubai.*Furniture offer/s);
    await ask('Which branch should I visit for electronics?');assert.match(await page.locator('.ai-branch').last().innerText(),/Abu Dhabi.*Electronics/s);
    await ask('Is the Samsung 55 inch TV available?');const tv=await page.locator('.ai-product').last().innerText();assert.match(tv,/Samsung 55 Inch TV/);assert.match(tv,/AED\s*1,799/);assert.match(tv,/Saved quantity: 10/);assert.match(tv,/In stock/);
    await ask('What deals are available in Dubai?');await ask('Do you have electronics?');assert.match(await page.locator('.ai-product').last().innerText(),/Samsung 55 Inch TV.*Abu Dhabi/s);
    await ask('I need a sofa.');await ask('Under AED 2500.');assert.match(await page.locator('.ai-product').last().innerText(),/Compact Sofa.*Dubai/s);
    await ask('Now I need electronics.');assert.match(await page.locator('.ai-product').last().innerText(),/Samsung 55 Inch TV.*Abu Dhabi/s);
    assert.doesNotMatch(await page.locator('.ai-messages').innerText(),/\*\*/);assert.equal(backend.db.Chat_Logs.length,9);assert.ok(backend.db.Chat_Logs.every(row=>row.chatbot_type==='ai_assistant'&&row.user_id==='AI-U1'));
    for(const size of [{width:1440,height:900},{width:390,height:844},{width:360,height:800}]){await page.setViewportSize(size);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));const box=await page.locator('.ai-panel').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1,JSON.stringify({size,box}));}
    await page.locator('.ai-close').click();assert.equal(await page.locator('.ai-panel.is-open').count(),0);
    backend.db._Sessions[0].revoked=true;await page.evaluate(()=>{sessionStorage.clear();});await page.goto(base);await page.waitForURL('**/pages/login.html');assert.equal(await page.locator('.ai-launcher').count(),0);assert.ok(await page.locator('#uiChatLauncher').isVisible(),'public Rule-Based chatbot remains on Login');
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
