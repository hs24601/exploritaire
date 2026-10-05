const {chromium}=require('playwright');const assert=require('node:assert/strict');const {findLayoutDefects}=require('./lib/layout-check.cjs');
// Both trays and their pinned notes at common desktop and phone sizes: nothing
// collides, escapes, clips, covers the corner studs or drops below 16px text.
const SUPPLY={parts:'.supply-tray__toggle, .supply-tray__well, .supply-row, .supply-row__token, .supply-row__count',cornerInset:12};
const QUEST={parts:'.quest-tray__toggle, .quest-tray__progress, .quest-discard-counter, .quest-tray__well, .quest-foundation, .quest-foundation__cards, .quest-tray .quest-card, .quest-card__title, .quest-card__text, .quest-card__reward',cornerInset:12};
// The longest quest title and objective in the expedition, to prove every face-up card fits.
const LONGEST={title:'Use the Day 2 ration for the Deep Woods round trip',text:'Return Hero to the city with the resources collected in Small Woods.'};
const TOAST={parts:'.pinned-toast__close, .pinned-toast h3, .pinned-toast p, .pinned-toast li, .pinned-toast__icon, .supply-details__place'};
const separate=(a,b)=>a.x+a.width<=b.x+0.5||b.x+b.width<=a.x+0.5||a.y+a.height<=b.y+0.5||b.y+b.height<=a.y+0.5;
(async()=>{const b=await chromium.launch({headless:true});const problems=[];try{
  for(const [w,h] of [[1912,914],[1600,900],[1366,768],[1280,720]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');await p.locator('.quest-card').waitFor();
    const at=(label,list)=>list.forEach(d=>problems.push(`${w}x${h} ${label}: ${d}`));
    at('supplies',await findLayoutDefects(p,'.supply-tray',SUPPLY));at('quests',await findLayoutDefects(p,'.quest-tray',QUEST));
    await p.evaluate(({title,text})=>{const card=document.querySelector('.quest-tray .quest-card');card.querySelector('.quest-card__title').textContent=title;card.querySelector('.quest-card__text').textContent=text;},LONGEST);
    at('quests, longest text',await findLayoutDefects(p,'.quest-tray',QUEST));
    assert.ok(await p.locator('.quest-tray .quest-card__text').isVisible(),'the active card shows its objective face up');
    const card=await p.locator('.quest-tray .quest-card').boundingBox();assert.ok(card.width>=60,`${w}x${h} quest card is ${card.width}px wide`);
    await p.reload();await p.locator('.quest-card').waitFor();const tray=await p.locator('.quest-tray').boundingBox();assert.ok(tray.width<=card.width+56,`${w}x${h} quest tray ${tray.width}px for a ${card.width}px card`);
    await p.locator('.quest-tray .quest-card').click();const note=p.locator('.quest-note');await note.waitFor();
    at('quest note',await findLayoutDefects(p,'.quest-note',TOAST));assert.ok(separate(await note.boundingBox(),tray),`${w}x${h} quest note covers the tray`);
    await p.locator('[data-supply="wood"]').click();const details=p.locator('.supply-details');await details.waitFor();
    at('supply details',await findLayoutDefects(p,'.supply-details',TOAST));assert.ok(separate(await details.boundingBox(),await p.locator('.supply-tray').boundingBox()),`${w}x${h} details cover the tray`);
    assert.ok(await note.isVisible(),'the quest note stays pinned while other things are tapped');
    if(process.env.SHOTS&&w===1600)await p.screenshot({path:process.env.SHOTS+'/trays-1600.png'});
    if(process.env.SHOTS&&w===1366)await p.screenshot({path:process.env.SHOTS+'/trays-1366.png'});
    await p.keyboard.press('Escape');await note.getByRole('button',{name:'Close'}).click();await note.waitFor({state:'detached'});
    await p.close();
  }
  for(const [w,h] of [[390,844],[844,390]]){
    const p=await b.newPage({viewport:{width:w,height:h}});await p.goto('http://localhost:5179/proto.html');
    const at=(label,list)=>list.forEach(d=>problems.push(`${w}x${h} ${label}: ${d}`));
    await p.getByRole('button',{name:'Supplies',exact:true}).click();at('supplies',await findLayoutDefects(p,'.supply-tray',SUPPLY));
    await p.locator('[data-supply="berries"]').click();at('supply details',await findLayoutDefects(p,'.supply-details',TOAST));
    const d=await p.locator('.supply-details').boundingBox();assert.ok(d.x>=0&&d.x+d.width<=w&&d.y>=0&&d.y+d.height<=h,`${w}x${h} details leave the screen`);
    if(process.env.SHOTS&&w===390)await p.screenshot({path:process.env.SHOTS+'/phone-supplies.png'});
    await p.keyboard.press('Escape');
    await p.getByRole('button',{name:'Quests',exact:true}).click();at('quests',await findLayoutDefects(p,'.quest-tray',QUEST));await p.locator('.quest-tray .quest-card').click();
    const n=await p.locator('.quest-note').boundingBox();assert.ok(n.x>=0&&n.x+n.width<=w&&n.y>=0&&n.y+n.height<=h,`${w}x${h} quest note leaves the screen`);
    at('quest note',await findLayoutDefects(p,'.quest-note',TOAST));
    if(process.env.SHOTS&&w===390)await p.screenshot({path:process.env.SHOTS+'/phone-quests.png'});
    await p.close();
  }
  assert.deepEqual(problems,[],'layout defects:\n'+problems.join('\n'));
  console.log('Trays and pinned notes: no collisions, escapes, clipping, stud overlap or sub-16px text at desktop and phone sizes.');
}finally{await b.close()}})().catch(e=>{console.error(e.message);process.exitCode=1});
