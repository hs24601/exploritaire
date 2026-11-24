const { chromium } = require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5178/proto.html');
 console.log(await page.evaluate(async()=>{
 const {default:React}=await import('/node_modules/.vite/deps/react.js');
 const client=await import('/node_modules/.vite/deps/react-dom_client.js'); const {createRoot}=client.default;
 const {TableauLandscape}=await import('/src/proto/components/TableauLandscape.tsx');
 const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;width:600px;height:600px;z-index:9999';document.body.append(host);
 const root=createRoot(host);
 const wait=async(predicate)=>{for(let i=0;i<200;i++){if(predicate())return;await new Promise(r=>setTimeout(r,50));}throw Error('Timed out');};
 const results=[];
 for(const tileType of ['berry-patch-sparse','berry-patch']){
 root.render(React.createElement(TableauLandscape,{tileType,berriesAvailable:true}));
 await wait(()=>host.querySelector(`[data-biome="${tileType}"][data-ready="true"] canvas`));
 await new Promise(r=>setTimeout(r,300)); const canvas=host.querySelector('canvas');
 let removed=0;const observer=new MutationObserver(entries=>{for(const e of entries)removed+=e.removedNodes.length;});observer.observe(canvas.parentNode,{childList:true});
 root.render(React.createElement(TableauLandscape,{tileType,berriesAvailable:false}));
 await wait(()=>host.querySelector('[data-berries="false"]'));
 await new Promise(r=>setTimeout(r,200));
 if(host.querySelector('canvas')!==canvas||removed)throw Error('Landscape replaced on harvest');
 observer.disconnect();results.push(tileType+': same canvas after depletion');
 }
 root.unmount();host.remove();return results;
 }));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});



