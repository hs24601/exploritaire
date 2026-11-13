/** Uses Proto's pigment/cloth asset-bar presentation without mounting React. */
export function createBookLoading(){
 const host=document.getElementById('book-loading')!,bar=host.querySelector<SVGElement>('[role="progressbar"]')!,fill=host.querySelector<SVGElement>('[data-loader-fill]')!,status=host.querySelector<HTMLElement>('[data-loader-status]')!,count=host.querySelector<HTMLElement>('[data-loader-count]')!;
 let progress=0;
 return {show(reset=true){if(reset)progress=0;host.style.display='grid';},report(value:number,label:string,done?:number,total?:number){progress=Math.max(progress,Math.min(.99,value));bar.setAttribute('aria-valuenow',String(Math.round(progress*100)));fill.setAttribute('width',String(584*progress));status.textContent=label;count.textContent=done===undefined?Math.floor(progress*100)+'%':total===undefined?`${done} prepared · ${Math.floor(progress*100)}%`:`${done}/${total} · ${Math.floor(progress*100)}%`;},finish(){bar.setAttribute('aria-valuenow','100');host.style.display='none';},fail(){host.style.display='none';}};
}
export const nextBookPaint=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
