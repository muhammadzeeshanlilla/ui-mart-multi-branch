import { api, getAuth } from './api.js';
import { config } from './config.js';
import { el, safeUrl, date, telephoneUrl, whatsappUrl, escapeHtml, dealBenefits } from './dom.js';

const page = document.body.dataset.page;
const root = page === 'home' ? './' : '../';
const main = document.getElementById('main');
const photos = {
  home: 'photo-1600210492486-724fe5c67fb0',
  'abu-dhabi': 'photo-1498049794561-7780e7231661',
  dubai: 'photo-1555041469-a586c61ea9bc',
  sharjah: 'photo-1530124566582-a618bc2615dc',
};
const photo = (key, width = 1000) => `https://images.unsplash.com/${photos[key]}?auto=format&fit=crop&w=${width}&q=85`;
// Fixed page routes and editorial copy stay local; practical facts come from Branches.
const branchPages = {
  AD: { id: 'abu-dhabi', headline: 'A smarter way<br>to everyday living.', text: 'Discover electronics for a connected life, along with kitchen essentials for every day.', label: 'CONNECTED LIVING' },
  DU: { id: 'dubai', headline: 'Make room<br>for better living.', text: 'Thoughtful furniture for your home and workspace, with kitchen essentials to bring it all together.', label: 'SPACES TO CALL YOUR OWN' },
  SH: { id: 'sharjah', headline: 'Built for your<br>next project.', text: 'Hardware, pipes, plumbing and utility essentials — with practical solutions for your kitchen too.', label: 'PRACTICAL BY DESIGN' },
};
let branchRecords = [], branchError = '';
// Sign-in/dashboard keep their existing loading path; they do not need public facts.
if (!['login', 'dashboard'].includes(page)) try {
  const response = await api('branches');
  branchRecords = response.branches.filter(b => b.is_active === true || /^(true|1)$/i.test(String(b.is_active).trim()));
} catch (error) { branchError = error.message; }
// Escape sheet strings before inserting them into the existing HTML templates.
const branches = branchRecords.filter(b => branchPages[b.branch_id]).map(b => ({
  ...branchPages[b.branch_id], city: escapeHtml(b.city), cityUpper: escapeHtml(String(b.city || '').toUpperCase()), branch_name: escapeHtml(b.branch_name),
  category: escapeHtml(b.specialization), intro: escapeHtml(b.description),
  tags: String(b.specialization || '').split(/[,;&]+/).map(t => escapeHtml(t.trim())).filter(Boolean),
}));
const selectedBranch = branchRecords.find(b => branchPages[b.branch_id]?.id === page);
const isBranchPage = Object.values(branchPages).some(b => b.id === page);
const logo = `<span class="logo-mark">u&i</span><span class="logo-name">U&I MART<small>EVERYDAY. TOGETHER.</small></span>`;
const href = id => id === 'home' ? `${root}index.html` : `${root}pages/${id === 'dashboard' ? 'owner-dashboard' : id}.html`;
const navItems = [['home','Home'],['abu-dhabi','Abu Dhabi'],['dubai','Dubai'],['sharjah','Sharjah'],['deals','Deals'],['contact','Contact Us'],['login','Login']];
document.getElementById('site-header').innerHTML = `<div class="container header-inner"><a class="logo" href="${href('home')}" aria-label="U and I Mart home">${logo}</a><button class="mobile-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="navigation">☰</button><nav class="nav" id="navigation" aria-label="Main navigation">${navItems.map(([id,label]) => `<a href="${href(id)}" ${page===id?'aria-current="page"':''} class="${id==='login'?'login-link':''}">${label}</a>`).join('')}</nav></div>`;
const footerBranches = ['login', 'dashboard'].includes(page) ? navItems.slice(1, 4).map(([id, city]) => ({ id, city })) : branches;
document.getElementById('site-footer').innerHTML = `<div class="container"><div class="footer-grid"><div class="footer-brand"><a class="logo" href="${href('home')}">${logo}</a><p>One company. Three specialized branches.<br>For your home, your work, and your everyday.</p></div><div><h3>Find your branch</h3>${footerBranches.map(b => `<a href="${href(b.id)}">${b.city}</a>`).join('')}</div><div><h3>Here to help</h3><a href="${href('deals')}">Branch deals</a><a href="${href('contact')}">Contact us</a><a href="${href('home')}#assistant">Ask our assistant</a><a href="${href('login')}">Customer & owner login</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} U&I Mart. All rights reserved.</span><span>Abu Dhabi &nbsp; · &nbsp; Dubai &nbsp; · &nbsp; Sharjah</span></div></div>`;
document.getElementById('preview-notice').hidden = !config.preview;
const toggle = document.querySelector('.mobile-toggle');
const nav = document.getElementById('navigation');
function closeNav() { nav.classList.remove('is-open'); toggle.setAttribute('aria-expanded','false'); }
toggle.addEventListener('click', () => { const open=nav.classList.toggle('is-open'); toggle.setAttribute('aria-expanded',String(open)); });
document.addEventListener('click', e => { if (!nav.contains(e.target) && !toggle.contains(e.target)) closeNav(); });
document.addEventListener('keydown', e => { if(e.key==='Escape') { closeNav(); } });
if (getAuth()) document.querySelector('.login-link').textContent = 'My account';

const heading = (eyebrow,title,aside='') => `<div class="section-heading"><div><p class="eyebrow">${eyebrow}</p><h2>${title}</h2></div>${aside}</div>`;
const cards = () => !branches.length ? `<p class="empty-state">${escapeHtml(branchError || "Branch details will be published soon.")}</p>` : `<div class="branch-grid">${branches.map((b,i)=>`<a class="branch-card" href="${href(b.id)}"><div class="branch-photo"><img src="${photo(b.id,650)}" alt="${b.category} inspiration" loading="lazy"><span class="branch-chip">0${i+1} &nbsp; ${b.cityUpper}</span></div><div class="branch-body"><h3>${b.branch_name}</h3><p class="category">${b.category}</p><p>${b.intro || b.text}</p><div class="branch-bottom">Explore ${b.city}<span aria-hidden="true">↗</span></div></div></a>`).join('')}</div>`;
const features = () => `<section class="soft-section section"><div class="container">${heading('THE U&I DIFFERENCE','Different needs. The same care.')}<div class="feature-grid"><article><div class="feature-icon" aria-hidden="true">◎</div><h3>Specialists in every branch</h3><p>A focused selection in each city makes it easier to find the right place for what you need.</p></article><article><div class="feature-icon" aria-hidden="true">◇</div><h3>Everyday essentials, together</h3><p>Kitchen items connect all three branches, alongside each location’s own specialty.</p></article><article><div class="feature-icon" aria-hidden="true">✧</div><h3>A little help goes a long way</h3><p>Ask our main-site assistant about prices, availability, branch information and current deals.</p></article></div></div></section>`;
const assistantBanner = () => `<section class="container section"><div class="assistant-banner"><div><p class="eyebrow">MEET YOUR U&I ASSISTANT</p><h2>Looking for something specific?</h2><p>From “Where can I find a sofa?” to “Pipe kidhar milay ga?” — our assistant helps you find the right branch, product details and deals.</p></div>${page==='home'?'<button class="button light" data-open-chat>Let’s talk <span aria-hidden="true">↗</span></button>':`<a class="button light" href="${href('home')}#assistant">Ask our assistant ↗</a>`}</div></section>`;
const dealsSection = () => `<section class="container section">${heading('A LITTLE MORE VALUE','Good things, better together.',`<a class="text-link" href="${href('deals')}">View all deals ↗</a>`)}<div id="deals-list" class="deals-grid" aria-live="polite"><p class="empty-state">Loading promotions…</p></div></section>`;

if (page==='home') {
  main.innerHTML = `<section class="hero container"><div class="hero-grid"><div class="hero-copy"><p class="eyebrow">WELCOME TO U&I MART</p><h1>One company.<br>Three branches.<br><span>Everyday possibilities.</span></h1><p>From a smarter home to a more comfortable space. Discover three specialized branches, brought together by U&I.</p><div class="button-row"><a class="button" href="#branches">Explore our branches <span aria-hidden="true">↗</span></a><button class="button secondary" data-open-chat>Ask our assistant ✧</button></div><div class="hero-note"><span class="dot"></span>Electronics. Furniture. Hardware. And more.</div></div><div class="hero-visual"><img id="hero-photo" src="${photo('home')}" alt="A welcoming contemporary living room" fetchpriority="high"><span class="photo-caption">Spaces that inspire · illustrative image</span><div class="visual-label"><strong>3</strong><span>Specialized branches.<br>One U&I promise.</span></div><div class="hero-index" aria-label="Choose inspiration image"><button aria-label="Living space inspiration" aria-pressed="true" data-slide="home">1</button><button aria-label="Electronics inspiration" aria-pressed="false" data-slide="abu-dhabi">2</button><button aria-label="Furniture inspiration" aria-pressed="false" data-slide="dubai">3</button></div></div></div></section><div class="container trust-strip"><span><b aria-hidden="true">⌖</b> Three locations across the UAE</span><span><b aria-hidden="true">◇</b> A specialty in every branch</span><span><b aria-hidden="true">♧</b> Kitchen essentials in every city</span><span><b aria-hidden="true">✧</b> One helpful assistant</span></div><section id="branches" class="container section">${heading('FIND YOUR U&I','Three cities. One connection.','<p>Each branch has its own specialty.<br>Find the one that’s right for you.</p>')}${cards()}</section>${features()}${dealsSection()}${assistantBanner()}`;
  // Reuses the old manual slide-index pattern, without an inaccessible automatic timer.
  document.querySelectorAll('[data-slide]').forEach(button=>button.addEventListener('click',()=>{
    document.getElementById('hero-photo').src=photo(button.dataset.slide);
    document.getElementById('hero-photo').alt=button.getAttribute('aria-label');
    document.querySelectorAll('[data-slide]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  }));
} else if (branches.some(b=>b.id===page)) {
  const b=branches.find(b=>b.id===page);
  main.innerHTML=`<section class="hero container"><div class="hero-grid"><div class="hero-copy"><p class="eyebrow">U&I MART / ${b.cityUpper}</p><h1>${b.headline}</h1><p>${b.text}</p><div class="button-row"><a class="button" href="#branch-contact">Plan your visit ↗</a><a class="button secondary" href="${href('home')}#assistant">Ask about products</a></div><div class="hero-note"><span class="dot"></span>${b.category}</div></div><div class="hero-visual"><img src="${photo(b.id)}" alt="${b.category} inspiration" fetchpriority="high"><span class="photo-caption">Illustrative image</span><div class="visual-label"><strong>U&I</strong><span>${b.city}<br>${b.label}</span></div></div></div></section><section class="container section">${heading('GET TO KNOW YOUR BRANCH',`Everyday possibilities in ${b.city}.`)}<p>${b.intro}</p><div class="filters" style="margin-top:25px">${b.tags.map(t=>`<span class="filter">${t}</span>`).join('')}</div><p class="small">For individual products, current prices and stock, ask the assistant on our main website.</p></section>${features()}${dealsSection()}<section class="container section" id="branch-contact">${heading('COME SAY HELLO',`Visit ${b.branch_name}.`)}<div id="contacts" class="contact-grid"><p class="empty-state">Loading branch information…</p></div></section>${assistantBanner()}`;
} else if (isBranchPage) {
  main.replaceChildren(el('p', 'container empty-state', branchError || 'This branch is not currently available.'));
} else if (page==='deals') {
  main.innerHTML=`<section class="container page-intro"><p class="eyebrow">MORE REASONS TO VISIT</p><h1>A little extra, from U&I.</h1><p>Discover promotions across our three branches. Ask our assistant about eligible products and availability.</p></section><section class="container section"><div class="filters" aria-label="Filter deals by branch">${['All branches',...branches.map(b=>b.city)].map((b,i)=>`<button class="filter" data-branch="${i?b:''}" aria-pressed="${!i}">${b}</button>`).join('')}</div><div id="deals-list" class="deals-grid" aria-live="polite"><p class="empty-state">Loading promotions…</p></div></section>${assistantBanner()}`;
} else if(page==='contact') {
  main.innerHTML=`<section class="container page-intro"><p class="eyebrow">LET’S CONNECT</p><h1>Three branches.<br>A warm welcome at each.</h1><p>Find branch details below. For product availability or current prices, start with our main-site assistant.</p></section><section class="container section"><div id="contacts" class="contact-grid"><p class="empty-state">Loading branch information…</p></div></section>${assistantBanner()}`;
} else if(page==='login') {
  await import('./auth.js');
} else if(page==='dashboard') {
  await import('./dashboard.js');
}

// The chat module may load before or after this module. Wire buttons after insertion too.
document.querySelectorAll('[data-open-chat]').forEach(button=>button.addEventListener('click',()=>{
  const launcher=document.getElementById('uiChatLauncher');
  if(launcher?.getAttribute('aria-expanded')!=='true') launcher?.click();
}));

let deals=[];
function renderDeals(branch='') {
  const target=document.getElementById('deals-list');
  target.replaceChildren();
  const list=deals.filter(d=>!branch||d.branch===branch);
  if(!list.length) { target.append(el('p','empty-state','There are no active promotions for this branch right now. Check back soon.')); return; }
  list.forEach(d=>{
    const card=el('article','deal-card');
    if(safeUrl(d.image_url)){ const img=el('img'); img.src=safeUrl(d.image_url); img.alt=d.title; img.loading='lazy';card.append(img); }
    const body=el('div','deal-content');
    body.append(el('span','tag',`${config.preview?'SAMPLE · ':''}${d.branch}`),el('h3','',d.title),el('p','',d.description),el('p','dates',`${date(d.start_date)} — ${date(d.end_date)}`));
    const benefits = dealBenefits(d);
    if (benefits) body.append(el('p','',benefits));
    const link=el('a','text-link','Ask about this deal ↗');link.href=`${href('home')}#assistant`;body.append(link);card.append(body);target.append(card);
  });
}
async function loadDeals(){
  if(!document.getElementById('deals-list'))return;
  try{if(branchError)throw new Error(branchError);deals=(await api('deals')).deals.filter(d=>branchRecords.some(b=>b.city===d.branch));renderDeals(selectedBranch?.city||'');}
  catch(error){document.getElementById('deals-list').replaceChildren(el('p','empty-state',error.message));}
  document.querySelectorAll('[data-branch]').forEach(button=>button.addEventListener('click',()=>{renderDeals(button.dataset.branch);document.querySelectorAll('[data-branch]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
}
async function loadContacts(){
  const target=document.getElementById('contacts');if(!target)return;
  try{
    if (branchError) throw new Error(branchError);
    target.replaceChildren();
    branchRecords.filter(b=>!isBranchPage||b.branch_id===selectedBranch?.branch_id).forEach(b=>{
      const card=el('article','contact-card');card.append(el('p','eyebrow',b.specialization),el('h3','',b.branch_name));
      if (b.description) card.append(el('p','small',String(b.description)));
      const dl=el('dl');
      [['City',b.city],['Location',b.address],['Opening hours',b.opening_hours],['Phone',b.phone],['Email',b.email]].forEach(([key,value])=>{dl.append(el('dt','',key),el('dd','',value||'Details will be published soon.'));});card.append(dl);
      const actions=el('div','contact-actions');
      const links=[['Directions',safeUrl(b.map_url)],['WhatsApp',whatsappUrl(b.whatsapp)],['Call',telephoneUrl(b.phone)],['Email',/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)?`mailto:${b.email}`:'']];
      links.forEach(([label,url])=>{if(!url)return;const a=el('a','',label);a.href=url;if(url.startsWith('https:')){a.target='_blank';a.rel='noopener noreferrer';}actions.append(a);});card.append(actions);target.append(card);
    });
    if(!target.children.length)target.append(el('p','empty-state','Branch details will be published soon.'));
  }catch(error){target.replaceChildren(el('p','empty-state',error.message));}
}
await Promise.allSettled([loadDeals(),loadContacts()]);
