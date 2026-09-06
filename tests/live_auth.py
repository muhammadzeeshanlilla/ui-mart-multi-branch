"""Interactive live account audit. Codes/tokens stay in memory, never in artifacts.
Run with a user-approved email. Provide JSON commands via stdin after READY.
"""
from live_test import ROOT, OUT, QuietHandler, emit, save
import sys, json, threading, functools, time
from http.server import ThreadingHTTPServer
from playwright.sync_api import sync_playwright
email=sys.argv[1]
server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'
with sync_playwright() as p:
    browser=p.chromium.launch(channel='msedge',headless=True)
    ctx=browser.new_context();page=ctx.new_page();page.set_default_timeout(35000)
    page.goto(base+'/pages/login.html',wait_until='domcontentloaded')
    page.locator('#email').fill(email);page.locator('#email-form button').click()
    page.wait_for_function("!document.querySelector('#email-form button').disabled")
    emit({'event':'code_request','email':email,'status':page.locator('#auth-status').inner_text(),'code_form':page.locator('#code-form').is_visible()})
    def call(action,payload={}):
        return page.evaluate("async ({action,payload})=>{try{return await (await import('/assets/js/api.js')).api(action,payload)}catch(e){return {success:false,message:e.message}}}",{'action':action,'payload':payload})
    emit({'event':'READY','commands':['verify','dashboard','logs','logout','request','quit']})
    for line in sys.stdin:
        try:
            command=json.loads(line);action=command['action']
            if action=='quit':break
            if action=='request':
                result=call('requestCode',{'email':email});emit({'event':'code_request',**result})
            if action=='verify':
                # Exercise the actual browser form, including code failure feedback.
                page.locator('#code').fill(command['code']);page.locator('#code-form button[type=submit]').click()
                page.wait_for_timeout(1000)
                page.wait_for_function("!document.querySelector('#code-form button[type=submit]') || !document.querySelector('#code-form button[type=submit]').disabled")
                if page.locator('#auth-status').count():emit({'event':'verify','status':page.locator('#auth-status').inner_text()})
                if page.evaluate("!!sessionStorage.getItem('ui_auth')"):
                    result=call('me');emit({'event':'signed_in','success':result.get('success'),'role':result.get('user',{}).get('role'),'token_in_session_storage':True})
                    save('auth-'+('owner' if result.get('user',{}).get('role')=='owner' else 'customer'),{'email':email,'me':result,'verified_at':time.strftime('%Y-%m-%dT%H:%M:%S')})
            if action=='dashboard':
                page.goto(base+'/pages/owner-dashboard.html',wait_until='domcontentloaded')
                page.wait_for_selector('h1');page.wait_for_function("!document.querySelector('#dashboard-status') || !document.querySelector('#dashboard-status').textContent.includes('Loading')")
                report=[]
                if page.locator('[data-tab]').count():
                    for tab in ['chats','users','logins','activities','deals','branches']:
                        page.locator('[data-tab="'+tab+'"]').click()
                        page.wait_for_function("!document.querySelector('#dashboard-status').textContent.includes('Loading')")
                        report.append({'tab':tab,'visible_records':page.locator('.record').count(),'status':page.locator('#dashboard-status').inner_text(),'pagination':page.locator('#page-count').inner_text()})
                    for width in [1440,1024,768,430,375]:
                        page.set_viewport_size({'width':width,'height':1000})
                        report.append({'width':width,'overflow':page.evaluate('document.documentElement.scrollWidth>innerWidth')})
                    emit({'event':'dashboard','results':report});save('owner-dashboard',report)
                else:emit({'event':'dashboard_denied','text':page.locator('main').inner_text(),'api':call('dashboard',{'tab':'users'})})
            if action=='logs':
                # Inspect only audit-related records in memory; save summaries, not full private logs.
                prefix=command.get('session_prefix','audit_');summary={}
                for tab in ['chats','logins','activities','users']:
                    matched=[];offset=0;total=0
                    while offset<=500:
                        result=call('dashboard',{'tab':tab,'offset':offset})
                        if not result.get('success'):emit(result);break
                        total=result['total']
                        for row in result['rows']:
                            if (tab=='chats' and str(row.get('session_id','')).startswith(prefix)) or (tab!='chats' and (row.get('user_email')==email or row.get('email')==email or row.get('user_id')==command.get('user_id'))):matched.append(row)
                        offset+=result['limit']
                        if offset>=total:break
                    summary[tab]={'total':total,'matched':len(matched),'scanned':min(offset,total)}
                    if tab=='chats':
                        keys=[(r.get('session_id'),r.get('user_message')) for r in matched]
                        summary[tab].update(duplicates=len(keys)-len(set(keys)),records=[{k:r.get(k) for k in ['session_id','user_message','detected_intent','detected_branch','detected_category','detected_product','timestamp']} for r in matched],malformed=[r.get('chat_id') for r in matched if not all(r.get(k) for k in ['session_id','user_message','bot_response','timestamp'])],secret_fields_found=any(any(k in str(r.get('bot_response','')) for k in ['token_hash','AUTH_SECRET','code_hash']) for r in matched))
                save('logs-verified',summary);emit({'event':'logs','summary':summary})
            if action=='logout':
                # Keep old bearer only in memory to verify server revocation, never print it.
                token=page.evaluate("JSON.parse(sessionStorage.getItem('ui_auth')||'null')?.token")
                result=call('logout');page.evaluate("sessionStorage.removeItem('ui_auth')")
                replay=page.evaluate("async token=>{const {config}=await import('/assets/js/config.js');const response=await fetch(config.apiUrl,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'me',session_id:'audit_revoke',token})});return await response.json()}",token)
                emit({'event':'logout','result':result,'old_token_me':replay,'browser_cleared':page.evaluate("!sessionStorage.getItem('ui_auth')")})
        except Exception as error:emit({'event':'error','message':str(error)})
    browser.close()
server.shutdown()
