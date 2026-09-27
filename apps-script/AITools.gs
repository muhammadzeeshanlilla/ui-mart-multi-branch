/** Trusted retrieval tools for the authenticated AI assistant. */
var AITools=(function(){
  const categoryTerms={
    'Electronics':['electronics','electronic','tv','television','laptop','computer','headphones','speaker','fridge','refrigerator'],
    'Furniture':['furniture','sofa','couch','bed','chair','table','desk','wardrobe','almari'],
    'Pipes':['pipe','pipes','pvc','piping','fitting'],
    'Hardware':['hardware','plumbing','tap','faucet','tool','drill','screw','wrench'],
    'Utility products':['utility','ladder','bucket'],
    'Kitchen Items':['kitchen','cookware','pan','pot','utensil','cutlery','crockery','kettle','bartan']
  };
  const branchNames=['Abu Dhabi','Dubai','Sharjah'];
  const broadCategoryTerms=['electronics','electronic','furniture','hardware','pipes','pipe','kitchen','items','utility','products'];
  const text=v=>ChatEngine.normalize(v);
  const active=v=>ChatEngine.active(v);
  function publicProduct_(p){return{product_id:String(p.product_id||''),name:String(p.product_name||''),category:String(p.category||''),branch:String(p.branch||''),description:String(p.description||''),price:p.price===''||p.price==null?null:Number(p.price),quantity:p.quantity===''||p.quantity==null?null:Number(p.quantity),stock_status:p.quantity===''||p.quantity==null?'unknown':Number(p.quantity)>0?'in_stock':'out_of_stock',brand:String(p.brand||''),unit:String(p.unit||'')};}
  function publicDeal_(d){return{deal_id:String(d.deal_id||''),title:String(d.title||''),branch:String(d.branch||''),category:String(d.category||''),product_id:String(d.product_id||''),description:String(d.description||''),discount_type:String(d.discount_type||''),discount_value:d.discount_value===''||d.discount_value==null?null:Number(d.discount_value),free_item:String(d.free_item||''),start_date:String(d.start_date||''),end_date:String(d.end_date||'')};}
  function publicBranch_(b){return{branch_id:String(b.branch_id||''),branch_name:String(b.branch_name||''),city:String(b.city||''),specialization:String(b.specialization||''),address:String(b.address||''),phone:String(b.phone||''),whatsapp:String(b.whatsapp||''),email:String(b.email||''),map_url:String(b.map_url||''),opening_hours:String(b.opening_hours||''),description:String(b.description||'')};}
  function data_(){
    const branches=DataService.getBranches().filter(b=>active(b.is_active));
    const cities=branches.map(b=>b.city);
    return{branches,products:DataService.getProducts().filter(p=>active(p.is_active)&&cities.includes(p.branch)),deals:DataService.getDeals().filter(d=>cities.includes(d.branch))};
  }
  function category_(message){const q=text(message);return Object.keys(categoryTerms).find(category=>categoryTerms[category].some(term=>new RegExp('(^| )'+text(term)+'( |$)').test(q)))||'';}
  function branch_(message){const q=text(message);return branchNames.find(city=>q.includes(text(city))||(city==='Abu Dhabi'&&q.includes('abudhabi')))||'';}
  function budget_(message){
    const q=String(message||'').replace(/,/g,'');
    const match=q.match(/(?:aed|dhs?|budget|under|below|within|around|up to|max(?:imum)?)[^0-9]{0,12}(\d+(?:\.\d{1,2})?)/i)||q.match(/(\d+(?:\.\d{1,2})?)[^a-z0-9]{0,5}(?:aed|dhs?)/i);
    const value=match?Number(match[1]):null;return Number.isFinite(value)&&value>=0?value:null;
  }
  function words_(value){return text(value).split(' ').filter(word=>word.length>1&&!['need','want','show','find','have','has','with','under','below','within','around','product','products','item','items','please','which','what','where','best','better','available','availability','stock','price','cost','compare','comparison','versus','and','the','for','from','this','these','those','my','your','me','should','visit','branch','branches','contact','location','address','hours','phone','whatsapp','deal','deals','offer','offers','discount','promotion','sale','do','does','is','are','now','new','looking','give','tell','about','cheaper','less','ones','same','aed','dhs'].includes(word));}
  function productTerms_(query,budget){return words_(query).filter(token=>!broadCategoryTerms.includes(token)&&!branchNames.some(city=>text(city).split(' ').includes(token))&&!(budget!==null&&token===String(budget)));}
  function productMatches_(query,data){
    const q=text(query),amount=budget_(query),terms=productTerms_(query,amount);
    const exact=data.products.filter(p=>{const name=text(p.product_name);return name&&q.includes(name);});
    if(exact.length)return{products:exact,filter:exact.map(p=>String(p.product_name)).join(', '),exact:true,terms};
    if(!terms.length)return{products:[],filter:'',exact:false,terms};
    const scored=data.products.map(p=>{const haystack=text([p.product_name,p.brand,p.keywords,p.description].join(' '));return{p,score:terms.reduce((total,term)=>total+(haystack.includes(term)?1:0),0)};}).filter(row=>row.score>0).sort((a,b)=>b.score-a.score);
    const required=terms.some(term=>/^\d+$/.test(term))||terms.length>1?Math.min(2,terms.length):1;
    return{products:scored.filter(row=>row.score>=required).map(row=>row.p),filter:terms.join(' '),exact:false,terms};
  }
  function searchProducts(query,filters,data){
    data=data||data_();filters=filters||{};const category=filters.category||category_(query),branch=filters.branch||branch_(query),match=productMatches_(query,data);
    let rows=data.products.filter(p=>(!category||p.category===category)&&(!branch||p.branch===branch)&&(!filters.stock_only||Number(p.quantity)>0)&&(!Number.isFinite(filters.max_price)||p.price!==''&&Number(p.price)<=filters.max_price)&&(!Number.isFinite(filters.min_price)||p.price!==''&&Number(p.price)>=filters.min_price));
    if(match.exact||match.terms.length){const ids=new Set(match.products.map(p=>String(p.product_id)));rows=rows.filter(p=>ids.has(String(p.product_id)));}
    return rows.sort((a,b)=>{const ain=Number(a.quantity)>0?0:1,bin=Number(b.quantity)>0?0:1;return ain-bin||(Number(a.price)||Number.MAX_SAFE_INTEGER)-(Number(b.price)||Number.MAX_SAFE_INTEGER);}).slice(0,4).map(publicProduct_);
  }
  function getProductDetails(productId,data){data=data||data_();const p=data.products.find(row=>String(row.product_id)===String(productId));return p?publicProduct_(p):null;}
  function checkStock(productId,data){const p=getProductDetails(productId,data);return p?{product_id:p.product_id,name:p.name,branch:p.branch,quantity:p.quantity,stock_status:p.stock_status}:null;}
  function getDeals(filters,data){data=data||data_();filters=filters||{};return data.deals.filter(d=>(!filters.branch||d.branch===filters.branch)&&(!filters.category||d.category===filters.category)&&(!filters.product_ids?.length||!d.product_id||filters.product_ids.includes(String(d.product_id)))).slice(0,4).map(publicDeal_);}
  function getBranchInfo(branch,data){data=data||data_();return data.branches.filter(b=>!branch||b.city===branch).map(publicBranch_);}
  function getBranchesForCategory(category,data){data=data||data_();const target=text(category);return data.branches.filter(b=>target&&text(b.specialization).includes(target)).map(publicBranch_);}
  function getContactInfo(branch,data){return getBranchInfo(branch,data).map(b=>({branch:b.city,address:b.address,opening_hours:b.opening_hours,phone:b.phone,whatsapp:b.whatsapp,email:b.email,map_url:b.map_url}));}
  function searchByBudget(filters,data){filters=filters||{};return searchProducts('',{category:filters.category||'',branch:filters.branch||'',max_price:Number(filters.max_price),stock_only:true},data);}
  function compareProducts(productIds,data){return(productIds||[]).slice(0,4).map(id=>getProductDetails(id,data)).filter(Boolean);}
  function build(message,memory){
    const data=data_(),q=text(message),remembered=memory?.context||{};
    const explicitCategory=category_(message),explicitBranch=branch_(message),amount=budget_(message),productMatch=productMatches_(message,data);
    const explicitProduct=productMatch.products.length>0&&(productMatch.exact||productMatch.terms.length>0);
    const followup=/\b(under|below|within|cheaper|less|budget|those|them|these|same|what about|how about|compare|comparison|deal|deals|offer|offers|discount)\b/.test(q)||amount!==null;
    const newTopic=!!(explicitCategory||explicitBranch||explicitProduct);
    const memoryUsed=!newTopic&&followup;
    const category=explicitProduct?(explicitCategory||String(productMatch.products[0].category||'')):(explicitCategory||(newTopic?'':followup?remembered.category||'':''));
    const branch=explicitBranch||(newTopic?'':followup?remembered.branch||'':'');
    const maxPrice=amount!==null?amount:(!newTopic&&followup&&Number.isFinite(remembered.budget)?remembered.budget:null);
    let intent=/\b(compare|comparison|versus|vs|better|difference)\b/.test(q)?'comparison':/\b(deal|deals|offer|offers|discount|sale|promotion)\b/.test(q)?'deals':/\b(address|location|located|hours|timing|phone|whatsapp|contact|branch|visit)\b/.test(q)?'branch_guidance':/\b(stock|available|availability|quantity)\b/.test(q)?'stock':amount!==null?'budget':'product_search';
    if(/^(hi|hello|hey|salam|assalam)/.test(q))intent='greeting';
    let products=[];
    if(intent==='comparison'){
      const direct=newTopic?searchProducts(message,{category,branch},data):[],ids=direct.map(p=>p.product_id);
      if(!newTopic)(remembered.product_ids||[]).forEach(id=>{if(!ids.includes(id))ids.push(id);});products=compareProducts(ids.slice(0,2),data);
    }else if(['product_search','stock','budget'].includes(intent))products=maxPrice!==null?searchByBudget({category,branch,max_price:maxPrice},data):searchProducts(explicitProduct?message:'',{category,branch,stock_only:false},data);
    const productIds=products.map(p=>p.product_id);
    const rememberedIds=!newTopic&&followup?(remembered.product_ids||[]):[];
    const dealProductIds=productIds.length?productIds:rememberedIds;
    const deals=intent==='deals'||products.length?getDeals({branch,category,product_ids:dealProductIds},data):[];
    const branches=explicitBranch?getBranchInfo(explicitBranch,data):category?getBranchesForCategory(category,data):intent==='branch_guidance'?getBranchInfo('',data):[];
    return{intent,filters:{category:category||null,branch:branch||null,budget:maxPrice,product:productMatch.filter||null},products,deals,branches,memory_used:memoryUsed,reset_memory:!memoryUsed,context:{category:category||null,branch:explicitBranch||(newTopic?'':branch)||null,budget:maxPrice,product_ids:productIds.length?productIds:rememberedIds.slice(0,4)}};
  }
  return{searchProducts,getProductDetails,checkStock,getDeals,getBranchInfo,getBranchesForCategory,searchByBudget,compareProducts,getContactInfo,build};
}());
