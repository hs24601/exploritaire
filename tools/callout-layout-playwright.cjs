const { chromium } = require('playwright');
const { build } = require('esbuild');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const bundle = await build({ stdin:{ contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {CalloutText, CalloutEditor} from './src/proto/components/CalloutEditor';
    const root=createRoot(document.getElementById('fixture'));
    window.renderEditor=()=>root.render(<CalloutEditor initial={{text:'…breakfast!',marks:[{start:1,end:10,effect:'wave'}],emoji:{actor:'hero',emotion:'happy'}}} speaker="Hero" onSave={()=>{}} onClose={()=>{}} onReset={()=>{}} />);
    window.renderCallout=(text,effect,expression,editing)=>root.render(<div className="proto-callout" data-expression={expression} style={{left:12,top:48}}><div className="proto-callout-content">{expression&&<div className="proto-callout-expression"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="40" fill="#d9a36a" /></svg></div>}<div className="proto-callout-copy"><strong>Hero</strong><span className="proto-callout-text"><CalloutText draft={{text,marks:effect?[{start:text.startsWith('…')?1:0,end:text.length,effect,potency:2}]:[]}} /></span></div><button className="proto-callout-next">…</button>{editing&&<button className="proto-callout-edit">✎</button>}</div></div>);
  `, resolveDir:process.cwd(),loader:'tsx'}, bundle:true,write:false,format:'iife',jsx:'automatic',loader:{'.css':'empty'},define:{'import.meta.env.BASE_URL':'"/"','import.meta.env.DEV':'false'} });
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  let cases=0;
  try {
    const page=await browser.newPage();
    await page.setContent('<style>'+fs.readFileSync('src/proto/components/callout.css','utf8')+'</style><div id="fixture"></div>');
    await page.addScriptTag({content:bundle.outputFiles[0].text});
    for(const width of [320,390,844,1280]) {
      await page.setViewportSize({width,height:720});
      for(const expression of [false,true]) for(const editing of [false,true]) for(const effect of [null,'wave','shake','glow','emphasis','whisper','rainbow']) {
        for(const text of ['…breakfast!','A','A longer callout with several words that must wrap naturally and preserve enough space beside the expression.']) {
          await page.evaluate(args=>window.renderCallout(...args),[text,effect,expression,editing]);
          await page.waitForTimeout(20);
          const result=await page.evaluate(()=>{
            const root=document.querySelector('.proto-callout'),name=root.querySelector('strong'),bubble=root.querySelector('.proto-callout-content');
            const r=root.getBoundingClientRect(),b=bubble.getBoundingClientRect(),n=name.getBoundingClientRect();
            const range=document.createRange();range.selectNodeContents(name);
            const lines=[...range.getClientRects()];
            const copy=root.querySelector('.proto-callout-copy');
            const wordTops=[...root.querySelectorAll('.callout-word')].map(word=>word.getBoundingClientRect().bottom);
            return {nameLines:lines.length,width:r.width,right:r.right,copyOverflow:copy.scrollWidth-copy.clientWidth,bubbleHeight:b.height,nameHeight:n.height,wordTops};
          });
          const label=JSON.stringify({width,expression,editing,effect,text});
          assert.equal(result.nameLines,1,'speaker must stay on one line: '+label+' '+JSON.stringify(result));
          assert(result.right<=width+1,'callout must fit viewport: '+label);
          assert(result.copyOverflow<=1,'copy must not overflow: '+label);
          if(text==='…breakfast!' && width>=390) assert(Math.max(...result.wordTops)-Math.min(...result.wordTops)<6,'ellipsis and breakfast stay together: '+label);
          cases++;
        }
      }
    }
    await page.evaluate(()=>window.renderCallout('…breakfast!','wave',true,false));
    await page.waitForTimeout(100);
    await page.screenshot({path:'artifacts/callout-layout-regression.png'});
    await page.evaluate(()=>window.renderEditor());
    await page.waitForSelector('dialog[open]');
    for(const width of [320,390,844,1280]) {
      await page.setViewportSize({width,height:720});
      const result=await page.locator('.callout-draft-preview__bubble').evaluate(root=>{
        const r=root.getBoundingClientRect(),parent=root.parentElement.getBoundingClientRect();
        const range=document.createRange();range.selectNodeContents(root.querySelector('strong'));
        return {lines:range.getClientRects().length,left:r.left,right:r.right,parentLeft:parent.left,parentRight:parent.right};
      });
      assert.equal(result.lines,1,'preview speaker at '+width);
      assert(result.left>=result.parentLeft-1 && result.right<=result.parentRight+1,'preview fits editor at '+width+' '+JSON.stringify(result));
      cases++;
    }
    console.log(cases+' callout layout cases passed.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});

