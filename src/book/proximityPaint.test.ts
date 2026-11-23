import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {ProximityPaint} from './proximityPaint';
import {createBookPaint} from './pagePaint';

describe('perimeter proximity painting',()=>{
 it('soaks remaining edges once the crossing is complete, preserving its painted trail',()=>{
  const field=new ProximityPaint(new THREE.Vector4(-9,34,18,27)),hero=new THREE.Vector3(0,0,55);
  field.update(3,hero,1);field.update(5,hero,1);expect(field.amountAt(0,55)).toBe(1);expect(field.amountAt(8,36)).toBe(0);
  field.finish(5);field.update(5.9,hero,1);expect(field.amountAt(0,55)).toBe(1);expect(field.amountAt(8,36)).toBeCloseTo(.5,1);
  field.update(7,hero,1);expect(field.amountAt(8,36)).toBe(1);field.dispose();
 });
 it('supports a bridge-local field without changing book bounds or shader defaults',()=>{
  const bounds=new THREE.Vector4(-4.2,34,8.4,27),field=new ProximityPaint(bounds),book=new ProximityPaint();
  field.update(3,new THREE.Vector3(0,0,55),1);field.update(5,new THREE.Vector3(0,0,55),1);
  expect(field.amountAt(0,55)).toBe(1);expect(field.amountAt(0,38)).toBe(0);expect(book.amountAt(0,55)).toBe(0);
  const paint=createBookPaint(new THREE.Texture(),()=>{}),material=new THREE.MeshLambertMaterial(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  paint.attach(mesh,119);const shader={vertexShader:'#include <project_vertex>',fragmentShader:'void main() {\n#include <opaque_fragment>\n}',uniforms:{}} as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);paint.setProximityPaint(119,field.texture,bounds);
  expect(shader.uniforms.forestProximityBounds.value.equals(bounds)).toBe(true);expect(book.bounds.z).toBe(20);
  field.dispose();book.dispose();
 });
 it('keeps the opening in sketch and paints only after the book is fully open',()=>{
  const p=new ProximityPaint(),camera=new THREE.Vector3(5,2,0);
  p.update(1,camera,.5);p.update(2,camera,.9);p.update(4,camera,.99);expect(p.amountAt(5,0)).toBe(0);
  p.update(5,camera,1);expect(p.amountAt(5,0)).toBe(0);p.update(5.9,camera,1);expect(p.amountAt(5,0)).toBeCloseTo(.5,1);expect(p.lightAt(5,0)).toBe(0);expect(p.amountAt(-7,0)).toBe(0);
  p.update(7,camera,1);expect(p.amountAt(5,0)).toBe(1);expect(p.lightAt(5,0)).toBe(1);p.dispose();
 });
 it('retains painted trails, reveals new areas nearby and resets on replay',()=>{
  const p=new ProximityPaint(),camera=new THREE.Vector3(5,2,0);p.update(3,camera,1);p.update(5,camera,1);
  camera.x=-5;p.update(7,camera,1);expect(p.amountAt(5,0)).toBe(1);expect(p.amountAt(-5,0)).toBe(0);p.update(9,camera,1);expect(p.amountAt(-5,0)).toBe(1);
  p.update(0,camera,0);expect(p.amountAt(5,0)).toBe(0);expect(p.lightAt(-5,0)).toBe(0);p.dispose();
 });
 it('does not light unpainted areas and handles points outside the book safely',()=>{
  const p=new ProximityPaint();p.update(3,new THREE.Vector3(5,24,0),1);p.update(8,new THREE.Vector3(5,24,0),1);expect(p.amountAt(5,0)).toBe(0);expect(p.amountAt(100,0)).toBe(0);p.dispose();
 });
 it('shares the field with real material uniforms and restores normal authoring',()=>{
  const p=new ProximityPaint(),paint=createBookPaint(new THREE.Texture(),()=>{}),material=new THREE.MeshStandardMaterial(),mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),material);
  paint.attach(mesh,5);const shader={vertexShader:'#include <project_vertex>',fragmentShader:'void main() {\n#include <opaque_fragment>\n}',uniforms:{}} as THREE.WebGLProgramParametersWithUniforms;material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
  paint.setForestPaint(5,1);paint.setProximityPaint(5,p.texture);expect(shader.uniforms.forestProximityEnabled.value).toBe(1);expect(shader.uniforms.forestProximityMap.value).toBe(p.texture);expect(shader.fragmentShader).toContain('bookInkAmount(p,uv');paint.setProximityPaint(5,null);expect(shader.uniforms.forestProximityEnabled.value).toBe(0);p.dispose();
 });
});
