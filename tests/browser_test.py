"""Real Edge tests: responsive pages, chat, filters, auth and dashboard contracts."""
from pathlib import Path
import sys, threading, functools, json
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools'))
from playwright.sync_api import sync_playwright

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
out=ROOT/'test-results';out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    ctx=browser.new_context()
    page=ctx.new_page();errors=[]
    page.on('pageerror',lambda error: errors.append(str(error)))
    pages=['index.html','pages/abu-dhabi.html','pages/dubai.html','pages/sharjah.html','pages/deals.html','pages/contact.html','pages/login.html','pages/owner-dashboard.html']
    checked=0
    for width,height in [(1440,1000),(768,1024),(390,844),(320,700)]:
        page.set_viewport_size({'width':width,'height':height})
        for path in pages:
            page.goto(base+'/'+path);page.wait_for_selector('h1');page.wait_for_timeout(400)
            assert page.locator('h1').count()==1,path
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),f'Overflow: {path} {width}'
            assert page.locator('#uiChatLauncher').count()==(1 if path=='index.html' else 0)
            assert page.locator('.ui-chat-product-card').count()==0
            if width==390:
                page.locator('.mobile-toggle').click();assert page.locator('#navigation').is_visible()
                page.keyboard.press('Escape');assert not page.locator('#navigation').is_visible()
            if path=='index.html' and width in [1440,390]:
                page.evaluate("document.querySelectorAll('img').forEach(img => img.loading='eager')")
                page.evaluate("Promise.all(Array.from(document.images).map(img => img.decode().catch(()=>{})))")
                page.screenshot(path=str(out/f'home-{width}.png'),full_page=True)
            if path.startswith('pages/') and width==1440:page.screenshot(path=str(out/(Path(path).stem+'.png')),full_page=True)
            checked+=1
    page.set_viewport_size({'width':1440,'height':1000})
    page.goto(base+'/index.html');page.wait_for_selector('[data-open-chat]');page.locator('[data-open-chat]').first.click()
    assert page.locator('#uiChatPanel').get_attribute('aria-hidden')=='false'
    page.locator('#uiChatInput').fill('TV price?');page.locator('#uiChatSend').click();page.wait_for_selector('.ui-chat-product-card')
    assert 'AED' in page.locator('#uiChatMessages').inner_text()
    assert 'Abu Dhabi' in page.locator('#uiChatMessages').inner_text()
    page.locator('#uiChatInput').fill('What is its stock?');page.locator('#uiChatSend').click();page.wait_for_timeout(450)
    assert page.locator('.ui-chat-product-name').count()==2
    page.screenshot(path=str(out/'chat-desktop.png'))
    page.keyboard.press('Escape');assert page.locator('#uiChatPanel').get_attribute('aria-hidden')=='true'
    page.goto(base+'/pages/deals.html');page.wait_for_selector('.deal-card')
    page.get_by_role('button',name='Dubai',exact=True).click();assert page.locator('.deal-card').count()==1
    assert 'Dubai' in page.locator('.deal-card').inner_text()
    page.goto(base+'/index.html#assistant');page.wait_for_selector('#uiChatPanel.is-open')
    page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(out/'chat-mobile.png'))
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    # Intercept only the live API for UI contract tests; this does not pretend to authenticate against Google.
    ctx.route('**/assets/js/config.js',lambda route:route.fulfill(content_type='text/javascript',body="export const config={preview:false,apiUrl:'https://script.google.com/macros/s/test/exec',timeoutMs:1000};"))
    calls=[]
    def api_route(route):
        body=json.loads(route.request.post_data);calls.append(body['action'])
        action=body['action'];response={'success':True}
        user={'user_id':'test-owner','name':'Test Owner','email':'owner@example.test','role':'owner'}
        if action=='requestCode':response['message']='Check your email.'
        elif action=='verifyCode':response.update(token='test-token',user=user,expires_at=9999999999999)
        elif action=='me':response['user']=user
        elif action=='dashboard':response.update(tab=body['tab'],rows=[{'user_message':'TV price?','bot_response':json.dumps({'reply':'AED 1,299 at Abu Dhabi.'})}],total=1,offset=0,limit=25,summary={'users':2,'logins':3,'chats':1,'deals':0})
        elif action=='branches':response['branches']=[]
        elif action=='deals':response['deals']=[]
        route.fulfill(content_type='application/json',body=json.dumps(response))
    ctx.route('https://script.google.com/**',api_route)
    page.goto(base+'/pages/login.html');page.locator('#email').fill('owner@example.test');page.locator('#email-form button').click();page.wait_for_selector('#code-form:visible')
    page.locator('#code').fill('12345678');page.locator('#code-form button[type=submit]').click();page.wait_for_url('**/owner-dashboard.html');page.wait_for_selector('.record')
    assert 'AED 1,299' in page.locator('.record').inner_text()
    page.screenshot(path=str(out/'dashboard-contract.png'),full_page=True)
    page.get_by_role('button',name='Users',exact=True).click();page.wait_for_timeout(300)
    page.locator('#logout').click();page.wait_for_url('**/login.html')
    assert page.evaluate("sessionStorage.getItem('ui_auth')") is None
    assert all(a in calls for a in ['requestCode','verifyCode','me','dashboard','logout'])
    # A failed chat request restores text and exits loading state.
    ctx.unroute('https://script.google.com/**')
    ctx.route('https://script.google.com/**',lambda route:route.fulfill(content_type='application/json',body=json.dumps({'success':False,'message':'Service unavailable'})))
    page.goto(base+'/index.html#assistant');page.wait_for_selector('#uiChatPanel.is-open');page.locator('#uiChatInput').fill('TV price');page.locator('#uiChatSend').click();page.wait_for_selector('.ui-chat-bubble--error')
    assert page.locator('#uiChatInput').input_value()=='TV price'
    assert not page.locator('#uiChatSend').is_disabled()
    assert not errors,errors
    print(json.dumps({'responsive_page_checks':checked,'javascript_errors':errors,'chat':'passed','filters':'passed','mobile_navigation':'passed','login_dashboard_logout_contract':'passed','error_recovery':'passed','screenshots':str(out)},indent=2))
    browser.close()
server.shutdown()
