// Focused branch/deal checks only. Uses the existing test-tool runtime; no app server.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const context = vm.createContext({ Date });
for (const file of ['Chatbot.gs', 'Store.gs']) vm.runInContext(read('apps-script/' + file), context);
const engine = context.ChatEngine;
const dom = import('data:text/javascript;base64,' + Buffer.from(read('assets/js/dom.js')).toString('base64'));
const branches = ['AD', 'DU', 'SH'].map((branch_id, i) => ({
  branch_id, city: ['Abu Dhabi', 'Dubai', 'Sharjah'][i], branch_name: ['AD from Sheets', 'Dubai from Sheets', 'Sharjah from Sheets'][i],
  specialization: ['Electronics & Kitchen Items', 'Furniture & Kitchen Items', 'Hardware, Pipes & Kitchen Items'][i],
  description: 'Description from Sheets ' + branch_id, is_active: true,
  phone: 3038163840, whatsapp: 'https://wa.me/971XXXXXXXXX', map_url: 'Google Maps link',
  address: '', email: 'branch@example.test', opening_hours: 'Sheet hours',
}));
const deals = [
  { deal_id: 'SH', branch: 'Sharjah', category: 'Tools', title: 'Hardware tools offer', description: 'Selected tools', discount_type: 'percentage', discount_value: 10 },
  { deal_id: 'DU', branch: 'Dubai', category: 'Furniture', title: 'Furniture offer', description: 'Buy selected sofas and receive a free Kitchen Cookware Set', discount_type: 'free_item', free_item: 'Kitchen Cookware Set' },
].map(d => ({ ...d, is_active: true, start_date: '2026-09-01', end_date: '2026-09-30' }));
const data = { branches, deals, products: [] };
const answer = q => engine.answer(q, data, {}, '2026-09-06T12:00:00Z');

test('Sharjah hardware/tools and Dubai furniture deals remain category-specific', () => {
  for (const question of ['What are the Sharjah hardware deals?', 'Any Sharjah tools deals?']) {
    const result = answer(question);
    assert.equal(result.deals.length, 1);
    assert.equal(result.deals[0].category, 'Hardware');
    assert.equal(result.deals[0].discount_value, 10);
  }
  assert.equal(answer('What are the Dubai furniture deals?').deals[0].free_item, 'Kitchen Cookware Set');
  assert.equal(answer('Dubai hardware deals').deals.length, 0);
  assert.equal(deals[0].category, 'Tools', 'compatibility must not mutate source data');
});

test('Date cells preserve sheet dates; offers include the whole UAE end date', async () => {
  context.Utilities = { formatDate: (date, timezone, format) => {
    assert.equal(format, 'yyyy-MM-dd');
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } };
  assert.equal(context.value_(new Date('2026-08-31T19:00:00Z'), 'start_date', 'Asia/Karachi'), '2026-09-01');
  assert.equal(context.value_(new Date('2026-09-29T19:00:00Z'), 'end_date', 'Asia/Karachi'), '2026-09-30');
  assert.equal(engine.activeDeals(deals, '2026-08-31T19:59:59Z').length, 0);
  assert.equal(engine.activeDeals(deals, '2026-08-31T20:00:00Z').length, 2);
  assert.equal(engine.activeDeals(deals, '2026-09-30T19:59:59Z').length, 2);
  assert.equal(engine.activeDeals(deals, '2026-09-30T20:00:00Z').length, 0);
  assert.equal((await dom).date('2026-09-01'), '1 Sept 2026');
});

test('Benefits show structured fields without repeating existing prose; contacts stay safe', async () => {
  const helpers = await dom;
  assert.equal(helpers.dealBenefits(deals[0]), '10% off');
  assert.equal(helpers.dealBenefits(deals[1]), '');
  assert.equal(helpers.dealBenefits({ ...deals[0], description: 'Save 10% today' }), '');
  assert.equal(helpers.dealBenefits({ ...deals[0], description: 'Save 10 percent today' }), '');
  assert.equal(helpers.dealBenefits({ discount_type: 'free_item', free_item: 'Cookware' }), 'Free: Cookware');
  assert.match(helpers.dealBenefits({ discount_type: 'fixed', discount_value: 25 }), /AED.*25.*off/);
  assert.equal(helpers.telephoneUrl(3038163840), '');
  assert.equal(helpers.whatsappUrl(branches[0].whatsapp), '');
  assert.equal(helpers.safeUrl(branches[0].map_url), '');
  assert.equal(helpers.telephoneUrl('+971 (50) 123-4567'), 'tel:+971501234567');
});

test('Preview engine matches Apps Script', () => {
  assert.ok(read('assets/js/chat-engine.js').replaceAll('\r\n', '\n').includes(read('apps-script/Chatbot.gs').replaceAll('\r\n', '\n')));
});

const livePath = path.join(root, 'test-results/live-consistency.json');
test('Updated engine finds Sharjah Hardware and Dubai Furniture in the captured live deals', { skip: !fs.existsSync(livePath) }, () => {
  const checks = JSON.parse(fs.readFileSync(livePath, 'utf8').replace(/^\uFEFF/, ''));
  const liveData = { products: [], branches: checks.find(c => c.request.action === 'branches').response.branches, deals: checks.find(c => c.request.action === 'deals').response.deals };
  const sharjah = engine.answer('What are the Sharjah hardware deals?', liveData, {}, '2026-09-06T12:00:00Z');
  assert.equal(sharjah.deals.length, 1);
  assert.equal(sharjah.deals[0].deal_id, 'DEAL006');
  assert.equal(sharjah.deals[0].category, 'Hardware');
  assert.equal(engine.answer('What are the Dubai furniture deals?', liveData, {}, '2026-09-06T12:00:00Z').deals.length, 2);
});

test('Browser: live branch facts, contacts, inactive/error states, deals and two chat lookups', async () => {
  const { chromium } = require('../.tools/playwright/driver/package');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => sessionStorage.setItem('ui_auth', JSON.stringify({token:'test-token'})));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let records = structuredClone(branches), failBranches = false;
    const calls = [];
    await page.route('https://images.unsplash.com/**', route => route.abort());
    await page.route('http://localhost/**', route => {
      const name = new URL(route.request().url()).pathname.slice(1);
      if (name === 'assets/js/config.js') return route.fulfill({ contentType: 'text/javascript', body: "export const config={preview:false,apiUrl:'https://script.google.com/macros/s/test/exec',timeoutMs:1000};" });
      const contentType = name.endsWith('.js') ? 'text/javascript' : name.endsWith('.css') ? 'text/css' : name.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
      return route.fulfill({ contentType, body: read(name) });
    });
    await page.route('https://script.google.com/**', route => {
      const payload = route.request().postDataJSON(); calls.push(payload.action);
      let response;
      if (payload.action === 'me') response = {success:true,user:{user_id:'test',name:'Test Customer',email:'test@example.test',role:'customer'}};
      else if (payload.action === 'branches') response = failBranches ? { success: false, message: 'Branch service unavailable' } : { success: true, branches: records };
      else if (payload.action === 'deals') response = { success: true, deals };
      else if (payload.action === 'chat') response = answer(payload.message);
      else throw Error('Unexpected action: ' + payload.action);
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
    });
    await page.goto('http://localhost/index.html');
    await page.waitForSelector('.branch-card');
    assert.equal(await page.locator('.branch-card').count(), 3);
    assert.match(await page.locator('.branch-card').first().innerText(), /AD from Sheets.*Electronics.*Description from Sheets AD/s);
    assert.equal(calls.filter(a => a === 'branches').length, 1);
    for (const [route, id] of [['abu-dhabi', 'AD'], ['dubai', 'DU'], ['sharjah', 'SH']]) {
      await page.goto(`http://localhost/pages/${route}.html`);
      await page.waitForSelector('.contact-card');
      assert.equal(await page.locator('.contact-card').count(), 1);
      assert.match(await page.locator('main').innerText(), new RegExp('Description from Sheets ' + id));
      assert.match(await page.locator('.contact-card').innerText(), /Sheet hours/);
      assert.equal(await page.locator('.contact-actions a').count(), 1, 'invalid contact links must stay hidden');
      assert.equal(await page.locator('#uiChatLauncher').count(), 0);
    }
    records[1].phone = '+971 50 1234567'; records[1].whatsapp = 'https://wa.me/971501234567'; records[1].map_url = 'https://maps.google.com/?q=Dubai';
    records[1].branch_name = '<img src=x onerror=alert(1)> & branch';
    records[1].specialization = 'Updated & specialty'; records[1].description = '<script>bad()</script>';
    await page.goto('http://localhost/pages/dubai.html'); await page.waitForSelector('.contact-card');
    assert.equal(await page.locator('.contact-actions a').count(), 4);
    assert.match(await page.locator('main').innerText(), /Updated & specialty/);
    assert.match(await page.locator('main').innerText(), /<script>bad\(\)<\/script>/);
    assert.equal(await page.locator('main img[src=x], main script').count(), 0);
    await page.goto('http://localhost/pages/contact.html'); await page.waitForSelector('.contact-card');
    assert.equal(await page.locator('.contact-card').count(), 3);
    records[1].is_active = false;
    await page.goto('http://localhost/index.html'); await page.waitForSelector('.branch-card');
    assert.equal(await page.locator('.branch-card').count(), 2);
    await page.goto('http://localhost/pages/dubai.html'); await page.waitForSelector('main .empty-state');
    assert.match(await page.locator('main').innerText(), /not currently available/);
    assert.equal(await page.locator('.contact-card,.deal-card').count(), 0);
    records = structuredClone(branches);
    await page.goto('http://localhost/pages/deals.html'); await page.waitForSelector('.deal-card');
    assert.match(await page.locator('.deal-card').first().innerText(), /10% off/);
    assert.match(await page.locator('.deal-card').first().innerText(), /1 Sept 2026 — 30 Sept 2026/);
    await page.getByRole('button', { name: 'Dubai', exact: true }).click();
    assert.equal(await page.locator('.deal-card').count(), 1);
    assert.equal((await page.locator('.deal-card').innerText()).match(/Kitchen Cookware Set/g).length, 1);
    await page.goto('http://localhost/index.html#assistant'); await page.waitForSelector('#uiChatPanel.is-open');
    for (const question of ['What are the Sharjah hardware deals?', 'What are the Dubai furniture deals?']) {
      await page.locator('#uiChatInput').fill(question); await page.locator('#uiChatSend').click();
      await page.waitForFunction(() => !document.querySelector('#uiChatInput').disabled);
    }
    const chat = await page.locator('#uiChatMessages').innerText();
    assert.match(chat, /Hardware tools offer.*10% off/s);
    assert.match(chat, /Furniture offer.*free Kitchen Cookware Set/s);
    failBranches = true;
    await page.evaluate(()=>{sessionStorage.removeItem('ui_shared_branches');sessionStorage.removeItem('ui_shared_deals');});
    await page.goto('http://localhost/index.html'); await page.waitForSelector('#branches .empty-state');
    assert.match(await page.locator('#branches').innerText(), /Branch service unavailable/);
    await page.goto('http://localhost/pages/contact.html'); await page.waitForSelector('#contacts .empty-state');
    assert.match(await page.locator('#contacts').innerText(), /Branch service unavailable/);
    assert.deepEqual(errors, []);
    assert.ok(calls.every(a => ['me', 'branches', 'deals', 'chat'].includes(a)));
  } finally { await browser.close(); }
});
