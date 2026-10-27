import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { KhadRoots } from './components/KhadRoots';
import { describe,it,expect } from 'vitest';
import { KHAD_ROOT_RULES, khadBridgeGeometry, khadRootGeometry, khadRootStructure, khadSilhouette, ruleViolations, silhouetteOverlap } from './khadRootGeometry';
import { khadRootGeometry as baselineGeometry } from './khadRootGeometryBaseline';

describe('Khad root growth',()=>{
  it('keeps card identity stable while varying silhouettes and ember phases',()=>{
    const a=khadRootGeometry('sparse-jack'),b=khadRootGeometry('sparse-queen');
    expect(khadRootGeometry('sparse-jack')).toEqual(a);
    expect(a.strands).not.toEqual(b.strands);
    expect(a.thorns).not.toEqual(b.thorns);
    expect(a.motes).not.toEqual(b.motes);
    expect(a.motes).toHaveLength(7);
    expect(a.strands[0]).toContain(`${a.anchor.x.toFixed(2)} ${a.anchor.y.toFixed(2)}`);
    expect(JSON.stringify(a)).not.toMatch(/NaN|Infinity/);
  });
  it('keeps thorn-bearing tapered silhouettes bounded across many card identities',()=>{
    for(let i=0;i<100;i++) {
      const growth=khadRootGeometry(`rooted-card-${i}`);
      expect(growth.thorns.length).toBeGreaterThan(15);
      for(const stem of growth.stems) {
        expect(stem.ribbon.endsWith(' Z')).toBe(true);
        const coordinates=stem.ribbon.match(/-?\d+\.\d+/g)!.map(Number);
        expect(coordinates.every(n=>Number.isFinite(n)&&n>-30&&n<170)).toBe(true);
      }
    }
  });
  it('grows hooked thorns along the group link with exact attachment endpoints',()=>{
    const bridge=khadBridgeGeometry({x:20,y:100},{x:50,y:10},'jack:queen');
    expect(bridge.center.startsWith('M20.00 100.00')).toBe(true);
    expect(bridge.center.endsWith('50.00 10.00')).toBe(true);
    expect(bridge.thorns.length).toBeGreaterThan(3);
    expect(bridge.scars.length).toBeGreaterThan(0);
  });
});

it('defaults to protected values and adds crossing growth only on opt-in',()=>{
  const normal=khadRootGeometry('sparse-jack');
  expect(khadRootGeometry('sparse-jack',false)).toEqual(normal);
  const covered=khadRootGeometry('sparse-jack',true);
  expect(covered.stems).toHaveLength(normal.stems.length+1);
  expect(covered.stems.slice(0,normal.stems.length)).toEqual(normal.stems);
  expect(normal.stems.every(stem=>stem.moonEdges.length>0)).toBe(true);
});

it('protects the printed value by default and removes its mask only for opt-in',()=>{
  const render=(obscureValue?:boolean)=>renderToStaticMarkup(createElement(KhadRoots,{groupId:'test',cardId:'test',obscureValue}));
  expect(render()).toContain('data-khad-value-clearance');
  expect(render(false)).toContain('data-khad-value-clearance');
  expect(render(true)).not.toContain('data-khad-value-clearance');
  expect(render(true)).toContain('width="33" height="36"');
});

describe('mandatory Khad Roots structure',()=>{
  const ids=Array.from({length:120},(_,i)=>`rule-card-${i*7919}`);
  it('grows every vine winding, unevenly thick, tapered, unknotted and clear of protected windows',()=>{
    for(const [i,id] of ids.entries()) for(const obscure of i%4?[false]:[false,true]) {
      const m=khadRootStructure(khadRootGeometry(id,obscure),obscure);
      expect(ruleViolations(m),`${id} ${JSON.stringify(m)}`).toBe(0);
    }
  });
  it('keeps cards from sharing one silhouette',()=>{
    const sil=ids.slice(0,80).map(id=>khadSilhouette(khadRootGeometry(id))),overlaps:number[]=[];
    for(let a=0;a<sil.length;a++) for(let b=a+1;b<sil.length;b++) overlaps.push(silhouetteOverlap(sil[a],sil[b]));
    overlaps.sort((p,q)=>p-q);
    expect(overlaps.reduce((s,o)=>s+o,0)/overlaps.length).toBeLessThanOrEqual(KHAD_ROOT_RULES.maxMeanSilhouetteOverlap);
    expect(overlaps[Math.floor(overlaps.length*.99)]).toBeLessThanOrEqual(KHAD_ROOT_RULES.maxP99SilhouetteOverlap);
    expect(overlaps[overlaps.length-1]).toBeLessThan(KHAD_ROOT_RULES.maxSilhouetteOverlap);
  });
  it('flags the frozen first version, proving the measures catch ruled lines, clipped thorns and stamped silhouettes',()=>{
    const measured=ids.slice(0,30).map(id=>khadRootStructure(baselineGeometry(id)));
    expect(measured.some(m=>m.straightRun>KHAD_ROOT_RULES.maxStraightRun)).toBe(true);
    expect(measured.some(m=>m.thornTipsClipped>0)).toBe(true);
    const sil=ids.slice(0,40).map(id=>khadSilhouette(baselineGeometry(id)));
    let worst=0; for(let a=0;a<sil.length;a++) for(let b=a+1;b<sil.length;b++) worst=Math.max(worst,silhouetteOverlap(sil[a],sil[b]));
    expect(worst).toBeGreaterThan(KHAD_ROOT_RULES.maxSilhouetteOverlap);
  });
  it('flags a tight knot and an underside glow',()=>{
    const ring=Array.from({length:30},(_,i)=>({x:50+Math.cos(i*.45)*6,y:120+Math.sin(i*.45)*6}));
    const center='M'+ring.map(p=>`${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' L');
    const ribbon='M'+ring.map(p=>`${(p.x+1).toFixed(2)} ${p.y.toFixed(2)}`).join(' L')+' L'+[...ring].reverse().map(p=>`${(p.x-1).toFixed(2)} ${p.y.toFixed(2)}`).join(' L')+' Z';
    expect(khadRootStructure({stems:[{center,ribbon,thorns:[],moonEdges:[]}]}).tightLoops).toBeGreaterThan(0);
    const line=Array.from({length:20},(_,i)=>({x:10+i*3,y:120}));
    const flat='M'+line.map(p=>`${p.x} ${p.y}`).join(' L'), band='M'+line.map(p=>`${p.x} ${p.y-2}`).join(' L')+' L'+[...line].reverse().map(p=>`${p.x} ${p.y+2}`).join(' L')+' Z';
    expect(khadRootStructure({stems:[{center:flat,ribbon:band,thorns:[],moonEdges:['M28 122 L34 122']}]}).undersideGlow).toBe(1);
  });
});
