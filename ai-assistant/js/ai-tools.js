const currency=new Intl.NumberFormat('en-AE',{style:'currency',currency:'AED'});
function node(tag,className,text){const element=document.createElement(tag);if(className)element.className=className;if(text!==undefined)element.textContent=text;return element;}
export function renderTrustedResults(container,response){
  const products=Array.isArray(response.products)?response.products:[];
  if(products.length){
    const list=node('div','ai-product-list');
    products.slice(0,4).forEach(product=>{
      const card=node('article','ai-product');
      card.append(node('strong','ai-product-name',product.name||'Product'),node('span','ai-product-place',[product.category,product.branch].filter(Boolean).join(' · ')));
      const facts=node('div','ai-product-facts');
      if(Number.isFinite(product.price))facts.append(node('b','',currency.format(product.price)));
      const stock=node('span','ai-stock '+(product.stock_status==='in_stock'?'is-in':'is-out'),product.stock_status==='in_stock'?'In stock':product.stock_status==='out_of_stock'?'Out of stock':'Stock unconfirmed');facts.append(stock);card.append(facts);
      if(Number.isFinite(product.quantity))card.append(node('small','',`Saved quantity: ${product.quantity}`));
      list.append(card);
    });container.append(list);
  }
  const deals=Array.isArray(response.deals)?response.deals:[];
  deals.slice(0,4).forEach(deal=>container.append(node('div','ai-deal',`${deal.branch}: ${deal.title}${deal.description?' — '+deal.description:''}`)));
  const branches=Array.isArray(response.branches)?response.branches:[];
  branches.slice(0,3).forEach(branch=>{
    const card=node('div','ai-branch');card.append(node('strong','',branch.branch_name||branch.city),node('span','',branch.specialization||''));
    if(branch.address)card.append(node('small','',branch.address));if(branch.opening_hours)card.append(node('small','',branch.opening_hours));container.append(card);
  });
}
