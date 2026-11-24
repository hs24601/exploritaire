import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {paintedPaperPanel} from './paperCutout';
describe('paper artwork GPU ownership',()=>{
 it('shares one texture across folds of one painting and releases only the final owner',()=>{
  const pixels=new Uint8ClampedArray(4*4*4).fill(255),art={width:4,height:4,getContext:()=>({getImageData:()=>({data:pixels})})} as unknown as HTMLCanvasElement;
  const a=paintedPaperPanel(art,2,.01,'#eee',0,.5),b=paintedPaperPanel(art,2,.01,'#eee',.5,1),map=(p:typeof a)=>((p.group.children[1] as THREE.Mesh).material as THREE.MeshStandardMaterial).map!;
  expect(map(a)).toBe(map(b));const old=map(a),dispose=vi.spyOn(old,'dispose');a.dispose();expect(dispose).not.toHaveBeenCalled();b.dispose();expect(dispose).toHaveBeenCalledOnce();
  const next=paintedPaperPanel(art,2,.01,'#eee');expect(map(next)).not.toBe(old);next.dispose();
 });
});
