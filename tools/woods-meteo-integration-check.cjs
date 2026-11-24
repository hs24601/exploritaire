const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const harness=String.raw`<script type="module">import RefreshRuntime from '/@react-refresh';RefreshRuntime.injectIntoGlobalHook(window);window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;</script><script type="module">
import * as THREE from '/node_modules/.vite/deps/three.js';
import {createWoodsSpellTest} from '/src/book/woodsSpellTest.ts';
import {createWoodsHandBoard} from '/src/book/woodsHandBoardOverlay.ts';
const camera=new THREE.PerspectiveCamera(50,1280/720,.12,9000),hero=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial()),enemy=new THREE.Mesh(new THREE.BoxGeometry(2,2.7,2),new THREE.MeshBasicMaterial());enemy.position.set(0,0,-4);
const scene=new THREE.Scene();scene.add(hero,enemy);const lookAt=new THREE.Vector3(0,1,-2);let legacyHits=0;
const cinematic=createWoodsSpellTest({hero,enemy,camera,lookAt,reduced:false,enabled:()=>true,paused:()=>false,freeze:()=>{},impact:()=>legacyHits++});
const combat=createWoodsHandBoard({camera,hero,khadroot:{root:enemy,attack(){},hurt(){},defeat(){},reset(){}},playMeteo:(...args)=>cinematic.playMeteo(...args),reduced:true,enabled:()=>!cinematic.active,paused:()=>false});
combat.update(0);combat.camera();combat.state.hand.push({id:'ready-meteo',rank:0,kind:'spell',spell:'meteo'});
window.test={combat,cinematic,camera,tick(dt){cinematic.update(dt);cinematic.camera(dt);},get legacyHits(){return legacyHits;}};
</script>`;
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{const p=await b.newPage({viewport:{width:1280,height:720}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('Page error: '+e.message);});await p.route('**/__meteo-check',r=>r.fulfill({contentType:'text/html',body:harness}));await p.goto('http://127.0.0.1:5178/__meteo-check',{waitUntil:'domcontentloaded',timeout:30000});await p.getByRole('button',{name:'Choose Hero abilities from HP plate',exact:true}).click();await p.getByRole('button',{name:'Close',exact:true}).click();const q=await p.evaluate(()=>test.camera.quaternion.toArray());await p.getByRole('button',{name:/^Cast Meteo at the Khadroot/}).click();
assert.equal(await p.evaluate(()=>test.cinematic.diagnostics.phase),'casting');
await p.evaluate(()=>test.tick(.6));assert.notDeepEqual(await p.evaluate(()=>test.camera.quaternion.toArray()),q);assert.equal(await p.evaluate(()=>test.combat.state.khadroot.hp),60);
await p.evaluate(()=>test.tick(1));assert.equal(await p.evaluate(()=>test.cinematic.diagnostics.meteor.stage),'constellation');assert.equal(await p.evaluate(()=>test.combat.state.khadroot.hp),60);
await p.evaluate(()=>test.tick(100));assert.equal(await p.evaluate(()=>test.combat.state.khadroot.hp),12);assert.equal(await p.evaluate(()=>test.combat.state.hand.some(c=>c.id==='ready-meteo')),false);assert.equal(await p.evaluate(()=>test.cinematic.diagnostics.phase),'returning');await p.evaluate(()=>test.tick(1));assert.equal(await p.evaluate(()=>test.cinematic.active),false);assert.equal(await p.evaluate(()=>test.legacyHits),0);
await p.evaluate(()=>test.tick(10));assert.equal(await p.evaluate(()=>test.combat.state.khadroot.hp),12);assert.deepEqual(errors,[]);console.log('Meteo star pan, constellation, impact-only damage, single hit and return passed');}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
