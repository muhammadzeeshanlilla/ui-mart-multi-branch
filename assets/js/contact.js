import { api } from './api.js';
import { currentUser } from './session.js';
import { el } from './dom.js';
const section=el('section','container section');
section.innerHTML='<div class="login-card contact-form-card"><h2>Send a message</h2><p id="contact-identity"></p><form id="contact-form"><label for="subject">Subject</label><input id="subject" maxlength="150" required><label for="contact-message">Message</label><textarea id="contact-message" rows="6" maxlength="4000" required></textarea><button class="button" type="submit">Send Message</button></form><p id="contact-status" class="status" role="status" aria-live="polite"></p></div>';
document.getElementById('main').append(section);
document.getElementById('contact-identity').textContent=`Sending as: ${currentUser.name} (${currentUser.email})`;
document.getElementById('contact-form').onsubmit=async event=>{
 event.preventDefault();const button=event.target.querySelector('button'),status=document.getElementById('contact-status');button.disabled=true;status.textContent='Sending…';
 try{const r=await api('contact',{subject:document.getElementById('subject').value,message:document.getElementById('contact-message').value});status.textContent=r.message;event.target.reset();}
 catch(e){status.textContent=e.message;}finally{button.disabled=false;}
};
