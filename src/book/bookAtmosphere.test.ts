import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {bookFogAmount,createBookAtmosphere} from './bookAtmosphere';
import {DEFAULT_BOOK_ATMOSPHERE,validPageDocument} from './pageDocument';
const settings={...DEFAULT_BOOK_ATMOSPHERE,enabled:true,density:.2};
describe('book atmosphere view consistency',()=>{
 it('holds the haze on a surface constant through low, overhead and close/far views',()=>{
  for(const height of [.15,1,4,8]){const expected=bookFogAmount(12,2,height,settings);for(const [distance,cameraY]of [[3,1],[14,3],[20,18],[30,25]])expect(bookFogAmount(distance,cameraY,height,settings)).toBeCloseTo(expected,12);}
 });
 it('retains the height bank, thickness response, off state and physical depth comparison',()=>{
  expect(bookFogAmount(12,2,.15,settings)).toBeGreaterThan(bookFogAmount(12,2,6,settings));
  expect(bookFogAmount(12,2,.15,{...settings,thickness:12})).toBeGreaterThan(bookFogAmount(12,2,.15,settings));
  expect(bookFogAmount(12,2,.15,{...settings,enabled:false})).toBe(0);
  const depth={...settings,mode:'depth' as const};expect(bookFogAmount(12,2,.15,depth)).toBeGreaterThan(bookFogAmount(12,18,.15,depth));
 });
 it('updates shader mode without replacing peek-through or fogging prose',()=>{
  const root=new THREE.Group(),material=new THREE.MeshStandardMaterial(),textMaterial=new THREE.MeshBasicMaterial(),text=new THREE.Mesh(new THREE.PlaneGeometry(1,1),textMaterial);text.userData.bookStory=true;root.add(new THREE.Mesh(new THREE.PlaneGeometry(1,1),material),text);
  const original=textMaterial.onBeforeCompile;material.onBeforeCompile=shader=>{shader.fragmentShader+='\n// existing peek';};const atmosphere=createBookAtmosphere();atmosphere.attach(root);const shader={vertexShader:'#include <project_vertex>',fragmentShader:'#include <opaque_fragment>',uniforms:{}} as THREE.WebGLProgramParametersWithUniforms;material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  expect(shader.fragmentShader).toContain('// existing peek');expect(shader.fragmentShader).toContain('applyBookFog(outgoingLight');expect(textMaterial.onBeforeCompile).toBe(original);
  atmosphere.set(settings);expect(shader.uniforms.bookFogConsistent.value).toBe(1);atmosphere.set({...settings,mode:'depth'});expect(shader.uniforms.bookFogConsistent.value).toBe(0);
 });
 it('loads older documents and validates the new behavior and thickness properties',()=>{
  const old={enabled:true,color:'#101c21',density:.1,height:4,softness:3,darkness:.25},doc={version:1,revision:0,pages:[{page:1,controls:[],atmosphere:old}]};expect(validPageDocument(doc)).toBe(true);expect(validPageDocument({...doc,pages:[{...doc.pages[0],atmosphere:{...old,mode:'consistent',thickness:6}}]})).toBe(true);for(const invalid of [{mode:'unknown'},{thickness:0},{thickness:Infinity}])expect(validPageDocument({...doc,pages:[{...doc.pages[0],atmosphere:{...old,...invalid}}]})).toBe(false);
 });
});
