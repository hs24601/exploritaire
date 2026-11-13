import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {BOOK_MAGIC,createBookMagic,coverRimPoint,magicPhase,magicPopupOpen} from './bookMagic';
import {forestPaintProgress} from './forestPaint';
import {forestFilmShots} from './forestFilm';
import {sampleBookOpening,sampleBookStage} from './bookCamera';
import pages from '../data/bookPages.json';

describe('the sparkle-operated book',()=>{
 it('previews the unfolded sketch with every authored pop-up down, then shuts it for the sparkles',()=>{
  const shots=forestFilmShots();expect(sampleBookOpening(shots,1,2000)).toBe(1);expect(forestPaintProgress(2)).toBe(0);
  expect(Object.values(sampleBookStage(shots,{},2000)).every(n=>n===0)).toBe(true);
  expect(sampleBookOpening(shots,1,3500)).toBe(0);expect(magicPhase(3.6)).toBe('arriving');
  expect(sampleBookOpening(shots,1,7200)).toBeCloseTo(.5);expect(forestPaintProgress(7.2)).toBe(0);
  expect(pages.pages.find(p=>p.page===2)!.controls.some(c=>c.kind==='text')).toBe(false);
 });
 it('brings the particles in from offscreen right and pins them to the moving cover rim',()=>{
  const world=new THREE.Scene(),cover=new THREE.Group();cover.position.y=.16;world.add(cover);
  const magic=createBookMagic(world,cover,[]),camera=new THREE.PerspectiveCamera(36,16/9,.1,100);camera.position.set(7.8,10.8,12);camera.lookAt(2.95,.2,0);camera.updateMatrixWorld();
  magic.update(3.5,true,camera,900);const pos=magic.swarm.geometry.getAttribute('position'),v=new THREE.Vector3().fromBufferAttribute(pos,0).project(camera);expect(v.x).toBeGreaterThan(1.2);
  for(const [t,angle]of [[6.4,.3],[7.4,2.1]]){cover.rotation.z=angle;magic.update(t,true,camera,900);for(const i of [0,90,180,270]){v.fromBufferAttribute(pos,i);cover.worldToLocal(v);expect(v.distanceTo(coverRimPoint(i/360))).toBeLessThan(.00001);}}
  expect(magic.update(0,true,camera,900).active).toBe(false);expect(magic.update(20,true,camera,900).shimmer).toBe(0);magic.dispose();
 });
 it('only raises mechanisms when their folded paint edge is reached',()=>{
  for(const [x,z,h]of [[-4.8,-2.25,3],[.75,-.7,2.6],[2.3,1.05,.95]]){expect(magicPopupOpen(0,x,z,h)).toBe(0);expect(magicPopupOpen(1,x,z,h)).toBe(1);let old=0;for(let p=0;p<1;p+=.01){const n=magicPopupOpen(p,x,z,h);expect(n).toBeGreaterThanOrEqual(old);old=n;}}
  expect(BOOK_MAGIC.paintStart).toBe(8.3);expect(forestPaintProgress(BOOK_MAGIC.paintStart)).toBe(0);expect(forestPaintProgress(BOOK_MAGIC.paintEnd)).toBe(1);
 });
});
