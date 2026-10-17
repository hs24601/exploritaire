import { chromium } from 'playwright';
const browser=await chromium.launch({headless:true,channel:"msedge"});
const results=[];
for(const [width,height,touch] of [[1440,1000,false],[390,844,true]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:touch,isMobile:touch});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5178/tooling.html');await page.getByRole('tab',{name:'Tableaus',exact:true}).click({timeout:120000});
 await page.getByRole('button',{name:'Add card',exact:true}).click();await page.getByRole('button',{name:'Undo',exact:true}).click();
 await page.getByRole('button',{name:'Assignments',exact:true}).click();await page.locator('.layout-assignments label').filter({hasText:'woods'}).locator('select').selectOption('berry-cluster');
 await page.getByRole('button',{name:'Apply layouts to playtest',exact:true}).click();
 await page.getByRole('button',{name:'Test',exact:true}).click();for(const id of ['c3-front','c2','c3-back','c4','c5','c6'])await page.getByRole('button',{name:new RegExp('Card '+id+',')}).click();await page.getByText('Layout cleared.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Design',exact:true}).click();const target=page.getByRole('button',{name:/Card c6,/});await target.scrollIntoViewIfNeeded();const box=await target.boundingBox();
 const start={x:box.x+box.width/2,y:box.y+box.height/2};
 if(touch){const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+18,y:start.y+12}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});}
 else {await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+30,start.y+20,{steps:5});await page.mouse.up();}
 const moved=await page.locator('aside label').filter({hasText:/^x$/}).locator('input').inputValue();if(Number(moved)<=2.6)throw Error('Card drag did not move at '+width);
 await page.getByRole('button',{name:'Undo',exact:true}).click();await page.screenshot({path:`artifacts/tableau-editor-${width}.png`,fullPage:true});
 results.push({width,errors,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});
 await context.close();
}
const p=await browser.newPage();const r=await p.goto('http://localhost:5178/proto.html');results.push({proto:r.status()});console.log(JSON.stringify(results));await browser.close();




