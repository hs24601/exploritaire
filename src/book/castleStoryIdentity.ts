import type {CastleBridgePuzzle} from './castleBridgePuzzle';
import './castleStoryIdentity.css';

export function createCastleStoryIdentity(host:HTMLElement,model:CastleBridgePuzzle,natural=false,naturalPage=120){
  host.classList.add('castle-story');
  const chapter=document.createElement('button');chapter.className='castle-story-entry';chapter.dataset.story='chapter';chapter.textContent=natural?'Chapter 1: The Living World':'Chapter 1: The Castle Grounds';
  const page=document.createElement('button');page.className='castle-story-entry';page.dataset.story='page';page.textContent=natural?`Page ${naturalPage}: ${(naturalPage===1110||naturalPage===1111)?'World Paint Studio':'The World Tree'}`:'Page 119: Building Bridges';
  for(const button of [chapter,page]){button.type='button';button.setAttribute('aria-haspopup','dialog');}
  host.querySelector('.castle-eyebrow')!.replaceWith(chapter);
  const heading=host.querySelector('h1')!;heading.replaceChildren(page);
  const actions=document.createElement('div');actions.className='castle-story-actions';host.append(actions);
  const dialog=document.createElement('dialog');dialog.className='castle-story-dialog';dialog.setAttribute('aria-labelledby','castle-story-heading');
  dialog.innerHTML='<header class="story-dialog-top"><h2 id="castle-story-heading"></h2><button class="story-dialog-close" aria-label="Close details">Close</button></header><div class="story-dialog-body"></div>';
  document.body.append(dialog);dialog.querySelector<HTMLButtonElement>('button')!.onclick=()=>dialog.close();
  dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
  let kind:'chapter'|'page'='chapter',revision='';
  function render(){
    if(natural){dialog.querySelector('h2')!.textContent=kind==='chapter'?'Chapter 1: The Living World':('Page '+naturalPage+': '+((naturalPage===1110||naturalPage===1111)?'World Paint Studio':'The World Tree'));dialog.querySelector('.story-dialog-body')!.innerHTML=kind==='chapter'?'<p>A great world tree shelters a living valley. Follow the falling water, explore the painted grove and watch its luminous fruit reflected in the river.</p><nav><a href="/book.html?page=117">Musical tableaus</a><br><a href="/book.html?page=118">Castle grounds</a><br><a href="/book.html?page=119">Building Bridges</a><br><a href="/book.html?page=120">World Tree</a><br><a href="/book.html?page=1110">World Paint Studio</a><br><a href="/book.html?page=1111">World Paint Studio · direct arrival</a></nav>':'<p>Explore beneath the ancient roots and hanging gardens. The river winds close behind the tree, gathering light from amber, rose, lavender and turquoise berries before flowing east.</p><p>Approach the waterfall to see the source of the painted current. This page is an exploration space; there is no bridge puzzle.</p><p>Basin proportions informed by <a href="https://sketchfab.com/3d-models/super-mario-64-peachs-castle-exterior-38a87167983943048b918fcdd415f9bf">Super Mario 64 – Peach’s Castle Exterior</a> by <a href="https://sketchfab.com/Garu.The.Ninja">Garu</a>, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. The stepped basin and waterfall geometry are rebuilt for this scene.</p>';return;}
    dialog.querySelector('h2')!.textContent=kind==='chapter'?'Chapter 1: The Castle Grounds':'Page 119: Building Bridges';
    const used=model.filled-4;
    dialog.querySelector('.story-dialog-body')!.innerHTML=kind==='chapter'?
      `<p>A lantern-lit castle rises beyond a quiet moat. Its paths hold scattered possibilities, and an unfinished crossing waits for Hero to give it shape.</p><p>Explore the grounds, gather Wood Plank cards and restore the way into the castle. Beyond its stone walls, the Sacred Forest Meadow awaits.</p><p class="story-quest-state">${model.complete?'The crossing is restored. The castle is within reach.':'Current page quest: Building Bridges.'}</p>`:
      `<p>The moat remembers the shape of a bridge. Bring it into the world, one wood plank at a time.</p><dl class="story-progress"><div><dt>Packs collected</dt><dd>${model.collected.size} / 3</dd></div><div><dt>Planks placed</dt><dd>${used} / 12</dd></div><div><dt>Bridge sections</dt><dd>${model.builtSections} / 3</dd></div></dl><p>Place a card one rank higher or lower than every card touching its edges. Corners do not count.</p><p>Complete a row to form a walkable section of sketch bridge. Leave whenever you wish; your placed cards remain. Approach the unfinished edge to see the rest of the bridge imagined ahead of Hero.</p><p>${model.complete?'The full blueprint is complete. Cross the bridge and let Hero’s footsteps fill it with color.':'Fill every position to reach the castle. Once the blueprint is complete, Hero’s footsteps will bring its colors to life.'}</p>`;
    if(kind==='chapter'){
      const section=document.createElement('section');section.className='story-testing';section.setAttribute('aria-label','Testing spaces');
      section.innerHTML='<h3>Testing spaces</h3><p>Open a testing space in a new tab.</p><nav aria-label="Testing spaces"></nav>';
      const spaces=[
        ['Flurry sticker reward','http://zenduo.tail867eff.ts.net:5178/117.html?reward=snowflake'],
        ['Castle grounds · exploration','http://zenduo.tail867eff.ts.net:5178/118.html'],
        ['Storybook · scenes and paint','http://zenduo.tail867eff.ts.net:5178/book.html'],
      ];
      for(const [label,url]of spaces){const link=document.createElement('a');link.textContent=label;link.href=url;link.target='_blank';link.rel='noopener noreferrer';section.querySelector('nav')!.append(link);}
      dialog.querySelector('.story-dialog-body')!.append(section);
    }
  }
  function show(next:typeof kind){kind=next;render();dialog.showModal();}
  chapter.onclick=()=>show('chapter');page.onclick=()=>show('page');
  return {actions,get open(){return dialog.open;},update(){const next=`${model.collected.size}:${model.filled}:${model.builtSections}`;if(next!==revision){revision=next;if(dialog.open)render();}}};
}
