/** Keep JSON off the inspector; expose a selected manual-copy field only on clipboard failure. */
export async function copyBookJson(value:unknown,label:string,status:(message:string)=>void){
 const text=JSON.stringify(value,null,2);try{await navigator.clipboard.writeText(text);status(label+' copied');}
 catch{const dialog=document.createElement('dialog');dialog.className='book-name-dialog';const heading=document.createElement('h3');heading.textContent='Copy '+label;const field=document.createElement('textarea');field.value=text;field.setAttribute('aria-label',label+' for manual copy');field.style.cssText='width:min(540px,75vw);height:45vh;display:block';const close=document.createElement('button');close.textContent='Close';close.onclick=()=>dialog.close();dialog.append(heading,field,close);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();field.focus();field.select();status('Clipboard unavailable; copy the selected JSON.');}
}
