const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  for(const width of [1440,390]){
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
   const errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:5178/proto.html?momentumsbx');await page.getByRole('checkbox',{name:'Decay',exact:true}).uncheck();
   await page.getByRole('checkbox',{name:'Values',exact:true}).uncheck();
   await page.getByRole('checkbox',{name:'Smoky billow',exact:true}).uncheck();
   await page.getByRole('button',{name:'+3',exact:true}).click();
   const core=await page.locator('[data-web-flame="3"]').evaluate(canvas=>{
    const gl=canvas.getContext('webgl'),pixels=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let total=0,lit=0;
    for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
     const px=(x+.5)/canvas.width*2-1+.08,py=1-(y+.5)/canvas.height*2-.06;
     if(Math.hypot(px,py)>.12)continue;
     total++;if(pixels[(y*canvas.width+x)*4+3]>100)lit++;
    }
    return lit/total;
   });
   assert.ok(core>.75,`Dense core coverage ${core}`);
   assert.equal(await page.locator('[role="alert"]').count(),0);
   await page.screenshot({path:`artifacts/momentum-design/${width}-dense-coils-3.png`,fullPage:true});
   await page.getByRole('button',{name:'04 Solar Filaments',exact:true}).click();await page.getByRole('button',{name:'Focus selected',exact:true}).click();
   await page.getByRole('button',{name:'Full',exact:true}).click();
   await page.screenshot({path:`artifacts/momentum-design/${width}-dense-coils-12.png`,fullPage:true});
   await page.getByRole('button',{name:'Empty',exact:true}).click();
   const empty=await page.locator('[data-web-flame="3"]').evaluate(canvas=>{
    const gl=canvas.getContext('webgl'),pixels=new Uint8Array(canvas.width*canvas.height*4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    return pixels.some((value,index)=>index%4===3&&value>0);
   });
   assert.equal(empty,false);assert.deepEqual(errors,[]);
   console.log(width,'dense core coverage',core.toFixed(3),'and transparent empty state passed');
   await page.close();
  }
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
