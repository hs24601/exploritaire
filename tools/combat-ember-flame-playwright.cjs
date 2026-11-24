const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const pixels=canvas=>{
 const gl=canvas.getContext('webgl'),data=new Uint8Array(canvas.width*canvas.height*4);
 gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,data);
 let hash=0,lit=0,blue=0;
 for(let i=0;i<data.length;i+=4){hash=(hash*31+data[i]+data[i+1]+data[i+2])>>>0;if(data[i+3]>50)lit++;if(data[i+2]>data[i]*1.2&&data[i+2]>80)blue++;}
 return {hash,lit,blue};
};

(async()=>{
 fs.mkdirSync('artifacts/momentum-design',{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const width of [1280,390]){
   const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'}),errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:5178/proto.html?combatsbx&scenario=005');
   await page.locator('.battle-config summary').click();
   await page.getByRole('checkbox',{name:'Momentum decay',exact:true}).uncheck();
   await page.locator('.battle-config summary').click();
   const canvas=page.locator('.battle-field .momentum-engine canvas[data-web-flame="0"]');
   const reserve=page.locator('.battle-field .momentum-engine__value');
   assert.equal(await page.locator('.momentum-engine__title').count(),0);
   assert.equal(await page.locator('.battle-field .momentum-engine__chamber').evaluate(node=>node.offsetWidth),width===390?140:180);
   assert.equal(await canvas.count(),1);
   assert.equal((await canvas.evaluate(pixels)).lit,0);
   await page.getByRole('button',{name:'Auto-M',exact:true}).click();
   await page.waitForTimeout(600);
   assert.match(await reserve.innerText(),/^Momentum\s*0$/);
   assert.ok((await canvas.evaluate(pixels)).lit>0,'Fractional builders must still fill the flame');
   for(let i=0;i<6;i++){await page.getByRole('button',{name:'Auto-M',exact:true}).click();await page.waitForTimeout(600);}
   assert.match(await reserve.innerText(),/^Momentum\s*\d+$/);
   assert.equal(await reserve.evaluate(node=>getComputedStyle(node).webkitTextStrokeWidth),'6px');
   assert.equal(await page.locator('.momentum-engine__chamber svg').count(),0);
   assert.ok((await canvas.evaluate(pixels)).lit>200);
   await page.screenshot({path:`artifacts/momentum-design/${width}-combat-ember.png`});
   await page.getByRole('button',{name:'Open Momentum abilities',exact:true}).click();
   const raised=page.locator('.ability-fan__gauge canvas[data-web-flame="0"]');
   assert.ok((await raised.evaluate(pixels)).lit>200,'Raised gauge must render, not clone a blank canvas');
   await page.locator('.ability-fan [data-skill="pounce"]').focus();
   assert.match(await page.locator('.ability-fan__projected-value').innerText(),/^\d+$/);
   const before=(await raised.evaluate(pixels)).hash;
   await page.waitForTimeout(250);
   assert.equal((await raised.evaluate(pixels)).hash,before);
   const gauge=await page.locator('.ability-fan__gauge').boundingBox(),close=await page.getByRole('button',{name:'Close',exact:true}).boundingBox();
   assert.ok(close.y>=gauge.y+gauge.height);
   await page.screenshot({path:`artifacts/momentum-design/${width}-combat-ember-radial.png`});
   await page.getByRole('button',{name:'Close',exact:true}).click();
   await page.getByRole('button',{name:'Open Momentum abilities',exact:true}).click();
   await page.locator('.ability-fan [data-skill="bash"]').press('Enter');
   await page.locator('[data-skill-target]').first().click();
   await page.waitForTimeout(1800);
   assert.equal(await page.getByRole('dialog',{name:'Momentum abilities',exact:true}).count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
   assert.deepEqual(errors,[]);
   console.log(width,'live Ember gauge, fractional fill/whole numbers, radial rendering, cast and viewport passed');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
