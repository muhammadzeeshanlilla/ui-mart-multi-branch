"""Opt-in live audit using the existing Python/Edge test harness, not an app server.

Usage: python tests/live_test.py api|pages|chat
Chat mode deliberately writes real guest chat logs. No email is sent and no sheet
source records are edited. Private authentication requires a separate owner login.
"""
from pathlib import Path
import sys, re, json, time, uuid, urllib.request, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.tools'))
OUT=ROOT/'test-results'/'live';OUT.mkdir(parents=True,exist_ok=True)
CONFIG=(ROOT/'assets/js/config.js').read_text(encoding='utf-8')
assert re.search(r'preview:\s*false',CONFIG),'Live audit requires preview: false'
URL=re.search(r"apiUrl:\s*'([^']+)'",CONFIG).group(1)
RUN='audit_'+time.strftime('%Y%m%d_%H%M%S')+'_'+uuid.uuid4().hex[:8]

def save(name,value): (OUT/(name+'.json')).write_text(json.dumps(value,indent=2,ensure_ascii=False),encoding='utf-8')
def emit(value): print(json.dumps(value,ensure_ascii=True),flush=True)
def request(payload=None,raw=None):
    req=urllib.request.Request(URL,data=(raw if raw is not None else json.dumps({'session_id':RUN,**payload}).encode()) if payload is not None or raw is not None else None,headers={'Content-Type':'text/plain;charset=utf-8'})
    started=time.monotonic()
    with urllib.request.urlopen(req,timeout=45) as response:
        text=response.read().decode();return {'http':response.status,'seconds':round(time.monotonic()-started,2),'data':json.loads(text)}

def api_tests():
    results=[]
    cases=[('status',None,None),('branches',{'action':'branches'},None),('deals',{'action':'deals'},None),('invalid action',{'action':'inventory'},None),('invalid session',{'action':'branches','session_id':'!'},None),('invalid JSON',None,b'{broken'),('array body',None,b'[]'),('missing message',{'action':'chat'},None),('long message',{'action':'chat','message':'x'*501},None),('missing auth me',{'action':'me'},None),('forged owner dashboard',{'action':'dashboard','token':'test-forged-token','role':'owner'},None),('missing auth logout',{'action':'logout'},None),('invalid email requestCode',{'action':'requestCode','email':'not-an-email'},None),('invalid code verifyCode',{'action':'verifyCode','email':'audit@example.invalid','code':'bad'},None)]
    for name,payload,raw in cases:
        try:
            response=request(payload,raw);ok=response['data'].get('success') is (name in ['status','branches','deals'])
            record={'test':name,'status':'PASS' if ok else 'NEEDS ATTENTION',**response}
        except Exception as error:record={'test':name,'status':'NEEDS ATTENTION','error':str(error)}
        results.append(record);save('api',{'run':RUN,'results':results});emit(record)

class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self,*args):pass

def browser_tests(mode):
    from playwright.sync_api import sync_playwright
    server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
    threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='msedge',headless=True)
        ctx=browser.new_context();page=ctx.new_page();errors=[];failed=[];responses=[];loaded=[]
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('console',lambda message:errors.append('console: '+message.text) if message.type=='error' else None)
        page.on('requestfailed',lambda r:failed.append({'url':r.url,'failure':r.failure}))
        page.on('request',lambda r:loaded.append(r.url))
        def response_event(r):
            if r.status>=400:failed.append({'url':r.url,'status':r.status})
            if 'script.googleusercontent.com' in r.url:
                try:responses.append(r.json())
                except Exception:pass
        page.on('response',response_event)
        page.add_init_script("sessionStorage.setItem('ui_chat_session', "+json.dumps(RUN)+")")
        page.add_init_script("""(() => {
          const original=window.fetch;
          window.__auditResponses=[];
          window.fetch=async (...args)=>{
            const response=await original(...args);
            if(String(args[0]).includes('script.google.com')) {
              try { window.__auditResponses.push(await response.clone().json()); } catch(e) {}
            }
            return response;
          };
        })();""")
        if mode=='pages':
            results=[];all_links=set()
            paths=['index.html','pages/abu-dhabi.html','pages/dubai.html','pages/sharjah.html','pages/deals.html','pages/contact.html','pages/login.html','pages/owner-dashboard.html']
            for width in [1440,1024,768,430,375]:
                page.set_viewport_size({'width':width,'height':1000 if width>768 else 900})
                for path in paths:
                    start_errors=len(errors);start_failed=len(failed);responses.clear();loaded.clear();issues=[]
                    try:
                        page.goto(base+'/'+path,wait_until='domcontentloaded');page.wait_for_selector('h1',timeout=35000)
                        if page.locator('#deals-list').count():page.wait_for_function("!document.querySelector('#deals-list').textContent.includes('Loading promotions')",timeout=35000)
                        if page.locator('#contacts').count():page.wait_for_function("!document.querySelector('#contacts').textContent.includes('Loading branch information')",timeout=35000)
                        text=page.locator('body').inner_text()
                        if page.evaluate('document.documentElement.scrollWidth>innerWidth'):issues.append('horizontal overflow')
                        if page.locator('#uiChatLauncher').count()!=(1 if path=='index.html' else 0):issues.append('wrong chatbot placement')
                        if re.search(r'\b(Hafsa|Pharmacy|Karachi|PKR)\b|Rs\.',text,re.I):issues.append('legacy content')
                        if page.locator('.ui-chat-product-card').count():issues.append('unexpected public product cards')
                        if any('/preview.js' in u for u in loaded):issues.append('live mode loaded preview data')
                        if any(r.get('success') is False for r in responses) and path!='pages/owner-dashboard.html':issues.append('backend application error')
                        if path=='pages/owner-dashboard.html' and 'Sign in to continue' not in text:issues.append('guest owner page did not deny access')
                        if re.search(r'temporarily unavailable|not connected|could not be reached|took too long|is not a function',text,re.I):issues.append('visible API/rendering error')
                        if page.locator('#contacts').count():
                            expected=3 if path=='pages/contact.html' else 1
                            if page.locator('.contact-card').count()!=expected:issues.append('live contact records did not render')
                        if page.locator('#preview-notice').is_visible():issues.append('preview banner in live mode')
                        if width<=768:
                            page.locator('.mobile-toggle').click()
                            if not page.locator('#navigation').is_visible():issues.append('mobile menu not opened')
                            page.keyboard.press('Escape')
                            if page.locator('#navigation').is_visible():issues.append('mobile menu did not close')
                        all_links.update(page.locator('a[href]').evaluate_all('(links)=>links.map(a=>a.href)'))
                        if path=='pages/deals.html':
                            for label in ['Abu Dhabi','Dubai','Sharjah','All branches']:
                                page.get_by_role('button',name=label,exact=True).click()
                                if label!='All branches':
                                    for tag in page.locator('.deal-content .tag').all_text_contents():
                                        if label not in tag:issues.append('deal filter mismatch: '+label)
                        if width in [1440,375]:page.screenshot(path=str(OUT/(Path(path).stem+f'-{width}.png')),full_page=True)
                        live_branches=next((r['branches'] for r in responses if 'branches' in r),None)
                        live_deals=next((r['deals'] for r in responses if 'deals' in r),None)
                        record={'page':path,'width':width,'status':'NEEDS ATTENTION' if issues or errors[start_errors:] else 'PASS','issues':issues,'console':errors[start_errors:],'network':failed[start_failed:],'contact_text':page.locator('#contacts').inner_text() if page.locator('#contacts').count() else None,'branch_payload':live_branches,'deal_payload':live_deals}
                    except Exception as error:record={'page':path,'width':width,'status':'NEEDS ATTENTION','error':str(error)}
                    results.append(record);save('pages',{'run':RUN,'results':results});emit({k:v for k,v in record.items() if k not in ['contact_text','branch_payload','deal_payload']})
            links=[]
            for url in sorted(all_links):
                if not url.startswith(base):continue
                target=url.split('#')[0]
                try:
                    r=ctx.request.get(target);links.append({'path':url.removeprefix(base),'http':r.status})
                except Exception as error:links.append({'path':url.removeprefix(base),'error':str(error)})
            save('links',links);emit({'internal_links':len(links),'broken':[x for x in links if x.get('http')!=200]})
        if mode in ['chat','chat-retry']:
            questions=['I need furniture','Do you sell sofa?','What is the price of Modern Sofa Set?','Do you have Queen Size Bed?','Which branch has furniture?','Furniture kaha milega?','I need electronics','Do you sell TV?','What is the TV price?','Which branch has electronics?','I need pipes','Do you have PVC pipe?','Where can I buy pipes?','Pipe kidhar milay ga?','Do you have kitchen items?','Which branches have kitchen items?','What deals do you have?','What is the Dubai deal?','Any furniture deal?','Which branch gives a free kitchen set?','Where is the Dubai branch?','Give me Sharjah contact number','What time does Abu Dhabi branch open?','hello','help me','random unclear message']
            if mode=='chat-retry':
                initial=json.loads((OUT/'chat-initial.json').read_text(encoding='utf-8'))
                questions=[r['question'] for r in initial['results'] if r['status']!='PASS']
            results=[]
            page.goto(base+'/index.html#assistant');page.wait_for_selector('#uiChatPanel.is-open')
            for index,question in enumerate(questions):
                if index==20:
                    emit({'event':'cooldown','reason':'Deployed rate limiter requires 61 seconds idle after 20 messages.'})
                    time.sleep(31);emit({'event':'cooldown','remaining_seconds':30});time.sleep(30)
                # Independent questions must not inherit another question's conversation context.
                if index:page.reload(wait_until='domcontentloaded');page.wait_for_selector('#uiChatPanel.is-open')
                page.wait_for_function("!document.querySelector('#deals-list').textContent.includes('Loading promotions')",timeout=35000)
                responses.clear();before=len(errors)
                page.locator('#uiChatInput').fill(question);page.locator('#uiChatSend').click()
                typing=page.locator('.ui-chat-typing').count()>0
                try:
                    page.wait_for_function("!document.querySelector('#uiChatInput').disabled",timeout=35000)
                    captured=page.evaluate('window.__auditResponses')
                    response=next((r for r in reversed(captured) if 'intent' in r or r.get('success') is False),None)
                    errors_ui=page.locator('.ui-chat-bubble--error').all_text_contents()
                    record={'question':question,'status':'PASS' if response and response.get('success') and not errors_ui else 'NEEDS ATTENTION','typing_shown':typing,'response':response,'ui_errors':errors_ui,'console':errors[before:]}
                    if response and response.get('products'):
                        rendered=page.locator('.ui-chat-product-card').inner_text() if page.locator('.ui-chat-product-card').count()==1 else '\n'.join(page.locator('.ui-chat-product-card').all_text_contents())
                        if any(p.get('price') is not None for p in response['products']) and 'AED' not in rendered:record['currency_issue']=True;record['status']='NEEDS ATTENTION'
                    if index in [2,15,21]:page.screenshot(path=str(OUT/f'chat-{index}.png'))
                except Exception as error:record={'question':question,'status':'NEEDS ATTENTION','error':str(error)}
                results.append(record);save(mode,{'run':RUN,'session_id':RUN,'results':results});emit(record)
                # One session is limited to 20 requests per sliding minute; pause only if needed.
                time.sleep(3)
            for width in [1440,1024,768,430,375]:
                page.set_viewport_size({'width':width,'height':900})
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
                page.locator('#uiChatClose').click();assert page.locator('#uiChatPanel').get_attribute('aria-hidden')=='true'
                page.locator('#uiChatLauncher').click();page.locator('#uiChatInput').wait_for(state='visible')
                bounds=page.locator('#uiChatPanel').bounding_box();assert bounds['x']>=0 and bounds['x']+bounds['width']<=width
                page.screenshot(path=str(OUT/f'chat-sizing-{width}.png'))
            save('chat-ui',{'status':'PASS','widths':[1440,1024,768,430,375],'console':errors,'network':failed})
        browser.close()
    server.shutdown()

if __name__=='__main__':
    mode=sys.argv[1]
    if mode=='api':api_tests()
    elif mode in ['pages','chat','chat-retry']:browser_tests(mode)
    else:raise SystemExit('Choose api, pages or chat')
