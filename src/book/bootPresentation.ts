/** Reveal initialized controls and scenery together, only after the first render. */
export function presentBookFrame(canvas:HTMLCanvasElement){
 if(document.documentElement.dataset.bookBoot==='ready')return;
 canvas.dataset.ready='true';
 document.documentElement.dataset.bookBoot='ready';
 document.getElementById('book-stage')?.setAttribute('aria-busy','false');
 const loading=document.getElementById('book-loading');if(loading){loading.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow','100');loading.querySelector('[data-loader-fill]')?.setAttribute('width','584');loading.style.display='none';}
}
