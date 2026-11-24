import { pageTitle } from './pageTitle';

const baseTitle=document.title;
const update=()=>{document.title=pageTitle(window.location.search,baseTitle);};
update();
window.addEventListener('popstate',update);
const restore:(()=>void)[]=[];
for(const method of ['pushState','replaceState'] as const){
 const original=window.history[method];
 window.history[method]=function(this:History,...args:Parameters<History['pushState']>){original.apply(this,args);update();};
 restore.push(()=>{window.history[method]=original;});
}
if(import.meta.hot)import.meta.hot.dispose(()=>{window.removeEventListener('popstate',update);restore.forEach(reset=>reset());document.title=baseTitle;});
