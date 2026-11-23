/* Run after aldan-scenes-playtest.cjs to check additional combat and migration. */
const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
const {findLayoutDefects}=require('./lib/layout-check.cjs');
const key='exploritaire.mote-trials.v3',dir='output/mote-trials',base=process.env.ALDAN_URL||'http://127.0.0.1:5178/aldan.html';
(async()=>{const b=await chromium.launch({headless:true});try{
const p=await b.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});p.setDefaultTimeout(10000);const fixtures=JSON.parse(fs.readFileSync(`${dir}/fixtures.json`,'utf8')),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base);
// Check the four-choice and later maps, including the actual label boxes.
for(const size of [{width:1280,height:720},{width:844,height:390}]){
 await p.setViewportSize(size);for(const fixture of [fixtures.map,fixtures.laterMap]){
  await p.evaluate(({key,fixture})=>localStorage.setItem(key,JSON.stringify(fixture)),{key,fixture});await p.reload();await p.locator('.combat-path').waitFor();const d=await findLayoutDefects(p,'.combat-path',{parts:'.combat-path__label',minFontSize:16});assert.deepEqual(d,[]);
 }
}
const high=await b.newPage({viewport:{width:844,height:390},deviceScaleFactor:3,reducedMotion:'reduce'});await high.goto(base);await high.evaluate(({key,s})=>localStorage.setItem(key,JSON.stringify(s)),{key,s:fixtures.map});await high.reload();await high.locator('.combat-path').waitFor();await high.screenshot({path:dir+'/landscape-map-'+Date.now()+'-3x.png'});await high.close();
const pair=await p.evaluate(async s=>{const m=await import('/src/expedition/sceneRun.ts');let b=structuredClone(s.run.battle);b.result='won';b.foes.forEach(f=>f.hp=0);s=m.sceneReducer(s,{type:'battle',key:m.sceneKey(s.run),battle:b});s=m.sceneReducer(s,{type:'reward',key:m.sceneKey(s.run),pick:s.run.offers.find(p=>p.id==='frost-mote')});return m.sceneReducer(s,{type:'choose-node',nodeId:'3-gale'});},fixtures.second);
for(const[name,size]of[['phone',{width:390,height:844}],['landscape',{width:844,height:390}]]){
 await p.setViewportSize(size);await p.evaluate(({key,pair})=>localStorage.setItem(key,JSON.stringify(pair)),{key,pair});await p.reload();await p.locator('.battle-field').waitFor();await p.waitForTimeout(250);assert.equal(await p.locator('.foundation-empty-tiles:visible').count(),0);const d=await findLayoutDefects(p,'.scene-run',{parts:'.scene-run__bar,.scene-run__stage,.scene-run__foot,.battle-field__team,.battle-field__middle,.battle-field__solver-dock',minFontSize:16});assert.deepEqual(d,[]);await p.screenshot({path:`${dir}/${name}-pair.png`});console.log(name,'pair layout passed');
}
// Actually play the optional pair with the same shared solver and enemy turns.
await p.setViewportSize({width:1280,height:720});for(let n=0;n<100;n++){
 const s=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert(s.run,'Survive the optional pair');if(s.run.battle.result){assert.equal(s.run.battle.result,'won');break;}
 if(s.run.battle.turn==='enemy'){await p.waitForTimeout(200);continue;}const auto=p.getByRole('button',{name:'Auto-Solve',exact:true});if(await auto.count()&&await auto.isEnabled()){await auto.click();await p.waitForTimeout(400);}if(await p.getByRole('button',{name:'Stop',exact:true}).count())continue;const end=p.getByRole('button',{name:'END TURN',exact:true});if(await end.isEnabled({timeout:250}).catch(()=>false))await end.click({timeout:1000}).catch(async error=>{const s=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);if(s.run?.battle?.result!=='won')throw error;});await p.waitForTimeout(200);
}await p.getByLabel('Victory rewards',{exact:true}).waitFor();console.log('Optional pair won');
// Old rewards are archived, not silently re-equipped; the old save is preserved.
const legacy={version:2,profile:{xp:5,rewards:[{id:'ice-armor',tier:0}]},run:{earned:[{id:'ice-armor',tier:1},{id:'glacial-lance',tier:0}],light:22}};
await p.evaluate(({key,legacy})=>{localStorage.removeItem(key);localStorage.setItem('exploritaire.aldan-scenes.v2',JSON.stringify(legacy));},{key,legacy});await p.reload();await p.locator('.battle-field').waitFor();const migrated=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);assert.deepEqual(migrated.run.rewards,[]);assert.deepEqual(migrated.run.motes,{});assert.equal(migrated.profile.rewards.length,2);assert.equal(migrated.profile.rewards[0].tier,1);assert.equal(await p.evaluate(()=>localStorage.getItem('exploritaire.aldan-scenes.v2')),JSON.stringify(legacy));assert(!/Seed|Travel|supplies/.test(await p.locator('body').innerText()));
const response=await p.goto('https://zenduo.tail867eff.ts.net/aldan.html');assert.equal(response.status(),200);await p.locator('.scene-run').waitFor();assert.equal(await p.title(),'Mote trials · Exploritaire');console.log('Served URL verified:',p.url());assert.deepEqual(errors,[]);console.log('PASS: optional pair, mobile layout, old-save collection import, clean baseline, served URL.');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
