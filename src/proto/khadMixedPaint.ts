import * as THREE from 'three';
import {applyMixedPaintSurface} from '../book/worldMixedPaint';
import {createBrushSheet} from '../book/vendor/patch-oil-paint/brush.js';

/** The world's continuous mixed-brush method, using Khadroot's own pigments.
 * Paint diffuse color before lighting so the original seam emission and hurt
 * flash remain intact. No overlay geometry, lights or animation-time uploads. */
export function paintKhadroot(materials:(THREE.MeshStandardMaterial|THREE.MeshBasicMaterial)[]){
 const brush=createBrushSheet(),field=new THREE.DataTexture(new Uint8Array([0,0,0,255]),1,1);
 field.needsUpdate=true;
 const uniforms={brush:{value:brush},uField:{value:field},strokeSize:{value:.12},relief:{value:.35},variation:{value:.46},paletteShift:{value:0},soilMoss:{value:0},soilWet:{value:0},mixedCoverage:{value:1},mixedRealLighting:{value:1},darkSoilPatch:{value:new THREE.Vector4()}};
 for(const material of materials)applyMixedPaintSurface(material,1,uniforms,{preserveColor:true});
 return {dispose(){brush.dispose();field.dispose();}};
}
