import { ChatEngine } from './chat-engine.js';

// Fictitious records exclusively for a labelled, offline preview. Never used in live mode.
const branches = [
  ['AD','Abu Dhabi','Electronics & Kitchen Items'],['DU','Dubai','Furniture & Kitchen Items'],['SH','Sharjah','Hardware, Pipes & Kitchen Items'],
].map(([branch_id,city,specialization])=>({branch_id,branch_name:`U&I Mart ${city}`,city,specialization,address:'',phone:'',whatsapp:'',email:'',map_url:'',opening_hours:'',description:'',is_active:true}));
const products=[
  ['AD-001','Smart TV 55 inch','Electronics','Abu Dhabi',1299,8,'tv television smart screen'],
  ['AD-002','Wireless headphones','Electronics','Abu Dhabi',149,0,'audio headphones'],
  ['DU-001','Three-seat sofa','Furniture','Dubai',1599,4,'sofa sofas couch couches seating'],
  ['DU-002','Queen bed frame','Furniture','Dubai',899,6,'bed beds furniture'],
  ['SH-001','PVC pipe 25mm','Pipes','Sharjah',18,60,'pipe pipes pvc plumbing'],
  ['SH-002','Adjustable wrench','Hardware','Sharjah',35,12,'wrench tool tools hardware'],
  ['SH-003','Utility ladder','Utility products','Sharjah',150,3,'ladder utility'],
  ['AD-K01','Kitchen cookware set','Kitchen Items','Abu Dhabi',129,10,'kitchen cookware pans pots bartan utensils'],
  ['DU-K01','Kitchen cookware set','Kitchen Items','Dubai',119,5,'kitchen cookware pans pots bartan utensils'],
  ['SH-K01','Kitchen cookware set','Kitchen Items','Sharjah',109,0,'kitchen cookware pans pots bartan utensils'],
].map(([product_id,product_name,category,branch,price,quantity,keywords])=>({product_id,product_name,category,branch,price,quantity,keywords,brand:'Sample brand',unit:'piece',is_active:true}));
const day=new Date();const end=new Date(day);end.setUTCDate(end.getUTCDate()+30);
const deals=[
  {deal_id:'DEMO-DU',title:'A little extra for your home',branch:'Dubai',category:'Furniture',description:'Sample promotion: buy selected furniture and receive a kitchen set free. Eligibility must be confirmed with the branch.',free_item:'Kitchen Set',image_url:'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=700&q=80'},
  {deal_id:'DEMO-AD',title:'Connect with everyday value',branch:'Abu Dhabi',category:'Electronics',description:'Sample promotion: selected electronics offers at our Abu Dhabi branch. Ask the assistant for sample product information.',free_item:'',image_url:'https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&w=700&q=80'},
  {deal_id:'DEMO-SH',title:'More for your next project',branch:'Sharjah',category:'Hardware',description:'Sample promotion: discover selected hardware offers at our Sharjah branch.',free_item:'',image_url:'https://images.unsplash.com/photo-1530124566582-a618bc2615dc?auto=format&fit=crop&w=700&q=80'},
].map(d=>({...d,start_date:day.toISOString().slice(0,10),end_date:end.toISOString().slice(0,10),is_active:true}));
export async function previewRequest(action,payload){
  await new Promise(resolve=>setTimeout(resolve,250));
  if(action==='branches')return{success:true,branches};
  if(action==='deals')return{success:true,deals};
  if(action==='chat')return ChatEngine.answer(payload.message,{products,deals,branches},payload.context);
  throw new Error('Sign-in and private records are available after the live service is connected. Preview mode does not authenticate users.');
}
