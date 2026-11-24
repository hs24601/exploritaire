import * as THREE from 'three';
import {mountGridTableau,type GridCard,type GridRender} from './gridTableau.js';
import {rankLabel} from '../proto/protoState';
import {worldGridTiles,worldGridTileGeometry,gridPolygonArea,worldGridCoordinate,worldGridStandPoint,WORLD_GRID_FIELD,WORLD_GRID_CARD,GRID_RIGHT,GRID_DOWN} from './worldCombatGridLayout';
import {worldGridFoldCards,worldGridFoldPose,worldGridFoldProgress,type FoldCard} from './worldGridFold';
import {createWorldGridPanel} from './worldGridPanel';
import {createFoundationTapConfirmation} from './foundationTap';

/** Terrain-fitted floor selection and folding tableau, driven by the shared source model. */
export function createWorldTerrainGrid(scene:THREE.Scene,height:(x:number,z:number)=>number,onCard:(card:GridCard,kind:'start'|'play'|'stock')=>boolean,paused:()=>boolean,boundary:{x:number;y:number}[]){
 const root=new THREE.Group();root.name='Terrain combat grid';scene.add(root);
 const panel=createWorldGridPanel(id=>{grid.activate(id);});
 const confirmation=document.createElement('div');confirmation.className='world-grid-confirmation';confirmation.setAttribute('role','group');confirmation.setAttribute('aria-label','Confirm foundation placement');confirmation.hidden=true;document.body.append(confirmation);
 const confirmButton=document.createElement('button'),cancelButton=document.createElement('button'),connectors=[document.createElement('i'),document.createElement('i')];
 confirmButton.textContent='✓';confirmButton.setAttribute('aria-label','Confirm foundation');cancelButton.textContent='×';cancelButton.setAttribute('aria-label','Cancel foundation');
 confirmation.append(...connectors,confirmButton,cancelButton);confirmation.addEventListener('pointerdown',e=>e.stopPropagation());
 const fragment=document.createDocumentFragment(),stage=document.createElement('div'),board=document.createElement('div');stage.id='stage';board.id='board';stage.append(board);fragment.append(stage);
 const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=880;const c=canvas.getContext('2d')!;
 for(let variant=0;variant<6;variant++)for(let rank=1;rank<=13;rank++){
  const back=variant===5,index=variant*13+rank-1,x=index%16*128,y=Math.floor(index/16)*176;
  c.save();c.translate(x,y);c.fillStyle=back?'#653d35':'#f4eddc';c.fillRect(0,0,128,176);c.strokeStyle='#ab9666';c.lineWidth=1.5;c.strokeRect(.75,.75,126.5,174.5);
  if(variant===0){const label=rankLabel(rank);c.fillStyle='#24251e';c.textAlign='center';c.textBaseline='middle';c.font='bold 45px Georgia';c.fillText(label,64,88);c.font='bold 21px Georgia';for(const [a,b] of [[17,18],[111,18],[17,158],[111,158]])c.fillText(label,a,b);}
  else if(back){c.strokeStyle='#bd9b6588';c.lineWidth=2;for(let i=-176;i<128;i+=16){c.beginPath();c.moveTo(Math.max(4,i),Math.max(4,-i));c.lineTo(Math.min(124,i+176),Math.min(172,128-i));c.stroke();}}
  else{c.fillStyle='#e5c67b';c.fillRect(variant===4?80:0,variant===2?129:0,variant<3?128:48,variant<3?47:176);c.fillStyle='#24342f';c.font='bold 26px Georgia';c.textAlign='center';c.textBaseline='middle';const p=variant===1?[64,22]:variant===2?[64,153]:variant===3?[23,35]:[105,35];c.fillText(rankLabel(rank),p[0],p[1]);}
  c.restore();
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=4;
 const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.3,side:THREE.DoubleSide,depthTest:true,depthWrite:true,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const addresses=document.createElement('canvas');addresses.width=WORLD_GRID_FIELD.columns*64;addresses.height=WORLD_GRID_FIELD.rows*32;const addressPaint=addresses.getContext('2d')!;
 addressPaint.font='bold 24px Georgia';addressPaint.textAlign='center';addressPaint.textBaseline='middle';addressPaint.fillStyle='#42605a';
 for(let i=0;i<WORLD_GRID_FIELD.columns*WORLD_GRID_FIELD.rows;i++)addressPaint.fillText(worldGridCoordinate(i),i%WORLD_GRID_FIELD.columns*64+32,Math.floor(i/WORLD_GRID_FIELD.columns)*32+16);
 const addressTexture=new THREE.CanvasTexture(addresses);addressTexture.colorSpace=THREE.SRGBColorSpace;addressTexture.minFilter=THREE.LinearMipmapLinearFilter;addressTexture.magFilter=THREE.LinearFilter;addressTexture.anisotropy=4;
 material.onBeforeCompile=shader=>{
  shader.uniforms.gridAddressTexture={value:addressTexture};
  shader.uniforms.worldGridFold=material.userData.foldUniform;shader.uniforms.worldGridFoldAxis={value:GRID_RIGHT};
  shader.vertexShader='attribute float gridPreview;varying float vGridPreview;attribute vec4 gridAddressUv;attribute vec4 gridFoldAnchor;attribute float gridCellVisible;attribute vec2 gridCardUv;varying vec4 vGridAddressUv;varying vec2 vGridFoldData;varying vec2 vGridCardUv;uniform float worldGridFold;uniform vec3 worldGridFoldAxis;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvGridAddressUv=gridAddressUv;vGridCardUv=gridCardUv;vGridFoldData=vec2(gridCellVisible,gridFoldAnchor.w<0.?1.:1.-smoothstep(.65,1.,worldGridFold));');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nif(gridFoldAnchor.w>=0.){float p=smoothstep(gridFoldAnchor.w*.08,.92+gridFoldAnchor.w*.08,worldGridFold);float angle=sin(p*3.14159265)*1.4;vec3 d=transformed-gridFoldAnchor.xyz;vec3 axis=worldGridFoldAxis;transformed=gridFoldAnchor.xyz+d*cos(angle)+cross(axis,d)*sin(angle)+axis*dot(axis,d)*(1.-cos(angle));transformed.y+=sin(p*3.14159265)*.45;}');
  shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvGridPreview=gridPreview;');
  shader.fragmentShader='varying float vGridPreview;uniform sampler2D gridAddressTexture;varying vec4 vGridAddressUv;varying vec2 vGridFoldData;varying vec2 vGridCardUv;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nif(vGridFoldData.x<.5)discard;diffuseColor.a*=vGridFoldData.y;if(!gl_FrontFacing){diffuseColor.rgb=texture2D(map,vec2((129.+vGridCardUv.x*126.)/2048.,1.-(705.+(1.-vGridCardUv.y)*174.)/880.)).rgb;}else if(vGridAddressUv.z>=0.&&vGridAddressUv.z<.12&&vGridAddressUv.w>.333&&vGridAddressUv.w<.667){vec4 addressInk=texture2D(gridAddressTexture,vGridAddressUv.xy);diffuseColor.rgb=mix(diffuseColor.rgb,addressInk.rgb,addressInk.a);}');
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','if(vGridPreview>3.5){diffuseColor.rgb*=.55;}else if(vGridPreview>.5){float edge=min(min(vGridCardUv.x,1.-vGridCardUv.x),min(vGridCardUv.y,1.-vGridCardUv.y));float line=1.-smoothstep(vGridPreview<1.5?.035:.018,vGridPreview<1.5?.055:.032,edge);if(vGridPreview>2.5)line*=step(.45,fract((vGridCardUv.x+vGridCardUv.y)*20.));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.95,.7,.22),line*.95);}\n#include <alphatest_fragment>');
 };material.customProgramCacheKey=()=> 'world-grid-fold-preview-v2';
 const tiles=worldGridTiles(boundary),tileByIndex=new Map(tiles.map(t=>[t.index,t])),mask=Array.from({length:WORLD_GRID_FIELD.columns*WORLD_GRID_FIELD.rows},(_,i)=>tileByIndex.has(i));
 const positions:number[]=[],canonical:number[]=[],owners:number[]=[],addressUvs:number[]=[],foldAnchors:number[]=[],cellVisibility:number[]=[],ranges=new Map<number,{start:number;count:number;error:number}>();
 for(const tile of tiles){
  const geometry=worldGridTileGeometry(tile,boundary,height),p=geometry.attributes.position,uv=geometry.attributes.uv,start=positions.length/3;let error=0;
  for(let i=0;i<p.count;i++){positions.push(p.getX(i),p.getY(i),p.getZ(i));canonical.push(uv.getX(i),uv.getY(i));addressUvs.push((tile.index%WORLD_GRID_FIELD.columns+(uv.getX(i)-.333)/.334)/WORLD_GRID_FIELD.columns,1-(Math.floor(tile.index/WORLD_GRID_FIELD.columns)+1-uv.getY(i)/.12)/WORLD_GRID_FIELD.rows,uv.getY(i),uv.getX(i));error=Math.max(error,Math.abs(p.getY(i)-height(p.getX(i),p.getZ(i))-WORLD_GRID_CARD.lift));if(i%3===0)owners.push(tile.index);}
  for(let i=0;i<p.count;i++){foldAnchors.push(tile.center.x,height(tile.center.x,tile.center.z)+WORLD_GRID_CARD.lift,tile.center.z,(tile.index%7)/7);cellVisibility.push(1);}ranges.set(tile.index,{start,count:p.count,error});geometry.dispose();
 }
 const floorGeometry=new THREE.BufferGeometry();floorGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));floorGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(canonical,2));floorGeometry.setAttribute('gridAddressUv',new THREE.Float32BufferAttribute(addressUvs,4));floorGeometry.computeVertexNormals();floorGeometry.computeBoundingBox();floorGeometry.computeBoundingSphere();
 const floor=new THREE.Mesh(floorGeometry,material);floor.name='Continuous card floor';floor.userData.worldGridSurface=true;root.add(floor);
 floorGeometry.setAttribute('gridFoldAnchor',new THREE.Float32BufferAttribute(foldAnchors,4));floorGeometry.setAttribute('gridCellVisible',new THREE.Float32BufferAttribute(cellVisibility,1));floorGeometry.setAttribute('gridCardUv',new THREE.Float32BufferAttribute(canonical,2));
 floorGeometry.setAttribute('gridPreview',new THREE.Float32BufferAttribute(Array(positions.length/3).fill(0),1));
 const stockCenter=new THREE.Vector3(9,0,5),stockGeometry=new THREE.PlaneGeometry(1,1,8,12),stockUv=stockGeometry.attributes.uv,stockPosition=stockGeometry.attributes.position;
 for(let i=0;i<stockPosition.count;i++){const p=stockCenter.clone().addScaledVector(GRID_RIGHT,(stockUv.getX(i)-.5)*WORLD_GRID_CARD.width).addScaledVector(GRID_DOWN,(.5-stockUv.getY(i))*WORLD_GRID_CARD.height);stockPosition.setXYZ(i,p.x,height(p.x,p.z)+.09,p.z);}
 stockGeometry.setAttribute('gridAddressUv',new THREE.Float32BufferAttribute(Array.from({length:stockPosition.count},()=>[0,0,-1,0]).flat(),4));
 stockGeometry.setAttribute('gridPreview',new THREE.Float32BufferAttribute(Array(stockPosition.count).fill(0),1));
 stockGeometry.setAttribute('gridFoldAnchor',new THREE.Float32BufferAttribute(Array.from({length:stockPosition.count},()=>[0,0,0,-1]).flat(),4));stockGeometry.setAttribute('gridCellVisible',new THREE.Float32BufferAttribute(Array(stockPosition.count).fill(1),1));stockGeometry.setAttribute('gridCardUv',new THREE.Float32BufferAttribute(Array.from(stockUv.array),2));
 stockPosition.needsUpdate=true;stockGeometry.computeVertexNormals();stockGeometry.computeBoundingBox();stockGeometry.computeBoundingSphere();const stock=new THREE.Mesh(stockGeometry,material);stock.name='Grid stock';root.add(stock);
 const stockCanonical=Array.from(stockUv.array),pickTargets=[floor,stock];
 type Display={card:FoldCard;mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;canonical:number[]};
 const displays=new Map<string,Display>(),fieldRecords=new Map<number,{id:string;rank:number;index:number;center:number[];pickable:boolean}>();
 let view:GridRender|undefined,previousPhase='pick',selectedIndex:number|undefined,selectedPoint:THREE.Vector3|undefined,jumping=false,mode:'field'|'landing'|'in'|'folded'|'out'|'receipt'='field',elapsed=0,amount=0,selectingMove=false,canceling=false;
 let openPositions=new Map<string|null,number>();
 let pendingId:string|undefined;
 const doubleTap=createFoundationTapConfirmation();
 let requestJump:((point:THREE.Vector3)=>boolean)|undefined,requestView=()=>{},onMoveCanceled=()=>{},canCard:((card:GridCard,kind:'start'|'play'|'stock')=>boolean)=()=>true;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fieldUniform={value:0};
 material.userData.foldUniform=fieldUniform;
 const foldStock=()=>{const anchor=tiles.find(t=>t.index===selectedIndex)?.center??stockCenter;return anchor.clone().addScaledVector(GRID_RIGHT,5.75);};
 function stamp(geometry:THREE.PlaneGeometry,rank:number,peek?:string,back=false){
  const variant=back?5:peek?['face','top','bottom','left','right'].indexOf(peek):0,atlas=variant*13+rank-1,uv=geometry.attributes.uv;
  for(let row=0;row<13;row++)for(let col=0;col<9;col++)uv.setXY(row*9+col,(atlas%16*128+1+col/8*126)/2048,1-(Math.floor(atlas/16)*176+1+row/12*174)/880);uv.needsUpdate=true;
 }
 function foldedGeometry(index:number,labels:boolean){
  const geometry=new THREE.PlaneGeometry(1,1,8,12),uv=geometry.attributes.uv,addresses:number[]=[],anchors:number[]=[],visible:number[]=[];
  for(let i=0;i<uv.count;i++){const u=uv.getX(i),v=uv.getY(i);addresses.push((index%WORLD_GRID_FIELD.columns+(u-.333)/.334)/WORLD_GRID_FIELD.columns,1-(Math.floor(index/WORLD_GRID_FIELD.columns)+1-v/.12)/WORLD_GRID_FIELD.rows,labels?v:-1,u);anchors.push(0,0,0,-1);visible.push(1);}
  geometry.setAttribute('gridAddressUv',new THREE.Float32BufferAttribute(addresses,4));geometry.setAttribute('gridFoldAnchor',new THREE.Float32BufferAttribute(anchors,4));geometry.setAttribute('gridCellVisible',new THREE.Float32BufferAttribute(visible,1));geometry.setAttribute('gridCardUv',new THREE.Float32BufferAttribute(Array.from(uv.array),2));(geometry.attributes.position as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);return geometry;
 }
 function maskField(hideUsed:boolean){
  const visibility=floorGeometry.attributes.gridCellVisible,hidden=new Set<number>();if(hideUsed)for(const d of displays.values())hidden.add(d.card.index);
  for(const [index,range]of ranges)for(let i=range.start;i<range.start+range.count;i++)visibility.setX(i,hidden.has(index)?0:1);visibility.needsUpdate=true;
 }
 function syncDisplays(next:GridRender,receipt=false){
  const wanted=new Set<string>();for(const card of worldGridFoldCards(next)){
   wanted.add(card.id);let d=displays.get(card.id);const previous=d?.mesh.userData.center as THREE.Vector3|undefined;if(receipt)card.from=previous?.clone()??card.to.clone();
   if(!d){const geometry=foldedGeometry(card.coordinateIndex,!card.peek),skin=material.clone();geometry.setAttribute('gridPreview',new THREE.Float32BufferAttribute(Array(117).fill(0),1));skin.onBeforeCompile=material.onBeforeCompile;skin.customProgramCacheKey=material.customProgramCacheKey;skin.depthWrite=card.visible;const mesh=new THREE.Mesh(geometry,skin);mesh.name='Folded card '+card.id;root.add(mesh);d={card,mesh,canonical:Array.from({length:117},(_,i)=>[i%9/8,1-Math.floor(i/9)/12]).flat()};displays.set(card.id,d);}
   if(d.card.coordinateIndex!==card.coordinateIndex||!!d.card.peek!==!!card.peek){
    const address=d.mesh.geometry.attributes.gridAddressUv;
    for(let i=0;i<address.count;i++){const u=d.canonical[i*2],v=d.canonical[i*2+1];address.setXYZW(i,(card.coordinateIndex%WORLD_GRID_FIELD.columns+(u-.333)/.334)/WORLD_GRID_FIELD.columns,1-(Math.floor(card.coordinateIndex/WORLD_GRID_FIELD.columns)+1-v/.12)/WORLD_GRID_FIELD.rows,card.peek?-1:v,u);}address.needsUpdate=true;
   }
   d.card=card;d.mesh.material.depthWrite=card.visible;d.mesh.material.color.set(card.peek&&!card.next?'#b9b6ab':'#ffffff');stamp(d.mesh.geometry,card.rank,card.peek);d.mesh.userData.worldGridCard={id:card.id};
  }
  for(const [id,d]of displays)if(!wanted.has(id)){d.mesh.geometry.dispose();d.mesh.material.dispose();d.mesh.removeFromParent();displays.delete(id);}
 }
 function positionDisplay(d:Display,p:number){
  const pose=worldGridFoldPose(d.card,p,height),positions=d.mesh.geometry.attributes.position,axis=d.card.peek==='left'||d.card.peek==='right'?GRID_DOWN:GRID_RIGHT,ground=height(pose.point.x,pose.point.z);
  for(let i=0;i<positions.count;i++){const offset=GRID_RIGHT.clone().multiplyScalar((d.canonical[i*2]-.5)*WORLD_GRID_CARD.width).addScaledVector(GRID_DOWN,(.5-d.canonical[i*2+1])*WORLD_GRID_CARD.height).applyAxisAngle(axis,pose.flip),x=pose.point.x+offset.x,z=pose.point.z+offset.z;positions.setXYZ(i,x,pose.point.y+offset.y+height(x,z)-ground,z);}
  positions.needsUpdate=true;d.mesh.geometry.computeBoundingBox();d.mesh.geometry.computeBoundingSphere();d.mesh.material.opacity=pose.opacity;d.mesh.visible=pose.opacity>.002;d.mesh.userData.center=pose.point;
 }
 function positionStock(p:number){
  const at=stockCenter.clone().lerp(foldStock(),p),positions=stockGeometry.attributes.position;
  for(let i=0;i<positions.count;i++){const x=at.x+GRID_RIGHT.x*(stockCanonical[i*2]-.5)*WORLD_GRID_CARD.width+GRID_DOWN.x*(.5-stockCanonical[i*2+1])*WORLD_GRID_CARD.height,z=at.z+GRID_RIGHT.z*(stockCanonical[i*2]-.5)*WORLD_GRID_CARD.width+GRID_DOWN.z*(.5-stockCanonical[i*2+1])*WORLD_GRID_CARD.height;positions.setXYZ(i,x,height(x,z)+.09,z);}positions.needsUpdate=true;stockGeometry.computeBoundingBox();stockGeometry.computeBoundingSphere();
 }
 function updatePickTargets(){pickTargets.length=0;if(mode==='field')pickTargets.push(floor);if(stock.visible&&mode==='field')pickTargets.push(stock);}
 function render(next:GridRender){
  view=next;fieldRecords.clear();const uv=floorGeometry.attributes.uv;
  const preview=floorGeometry.attributes.gridPreview;for(const [index,range]of ranges){const id=next.state.field[index],role=id?next.layout[id]?.pv:null,value=role==='found'?1:role==='top'?2:role==='back'?3:role==='off'?4:0;for(let i=range.start;i<range.start+range.count;i++)preview.setX(i,value);}preview.needsUpdate=true;
  next.state.field.forEach((id,index)=>{const tile=tileByIndex.get(index),range=ranges.get(index);if(!id||!tile||!range)return;const rank=next.cards[id].rank,atlas=rank-1;for(let i=range.start;i<range.start+range.count;i++)uv.setXY(i,(atlas%16*128+1+canonical[i*2]*126)/2048,1-(Math.floor(atlas/16)*176+1+(1-canonical[i*2+1])*174)/880);fieldRecords.set(index,{id,rank,index,center:[tile.center.x,height(tile.center.x,tile.center.z),tile.center.z],pickable:!!next.layout[id]?.pick});});uv.needsUpdate=true;
  if(next.phase==='play'){
   selectedIndex=next.state.originIndex;
   if(previousPhase==='pick'){syncDisplays(next);for(const d of displays.values()){const index=openPositions.get(d.card.id);if(index!==undefined)d.card.from=tileByIndex.get(index)?.center.clone()??d.card.from;}elapsed=0;amount=0;mode=canceling?'in':'landing';if(canceling)maskField(true);else{maskField(false);for(const d of displays.values())d.mesh.visible=false;}floor.visible=true;fieldUniform.value=0;}
   else if(mode==='folded'){syncDisplays(next,true);mode='receipt';elapsed=0;}
  }else if(previousPhase==='play'){
   const byId=new Map(next.state.field.map((id,index)=>[id,index]));for(const d of displays.values()){const index=byId.get(d.card.id);if(index!==undefined){d.card.index=index;d.card.from=tileByIndex.get(index)?.center.clone()??d.card.to.clone();}}
   mode='out';elapsed=0;amount=1;fieldUniform.value=1;maskField(true);floor.visible=true;
  }
  if(next.phase==='pick')openPositions=new Map(next.state.field.map((id,index)=>[id,index]));
  previousPhase=next.phase;stock.visible=next.state.stock.length>0;stock.userData.worldGridCard={id:next.state.stock[next.state.stock.length-1]};stamp(stockGeometry,1,undefined,true);updatePickTargets();
 }
 const grid=mountGridTableau({stage,board,cardScale:.67,fieldColumns:WORLD_GRID_FIELD.columns,fieldRows:WORLD_GRID_FIELD.rows,fieldMask:mask,denseBackfill:true,singleClickPick:true,paused:()=>paused()||jumping||!['field','folded'].includes(mode),
  onCard(card,kind){
   if(!canCard(card,kind))return false;
   if(kind==='start'){
    const index=view?.state.field.indexOf(card.id);if(index===undefined||index<0||selectingMove&&index===selectedIndex)return false;
    const target=worldGridStandPoint(index);target.y=height(target.x,target.z)+WORLD_GRID_CARD.lift;if(!requestJump?.(target))return false;
    selectedPoint=target;selectingMove=false;
   }
   return onCard(card,kind);
  },onRender:render
 });
 function clearCandidate(){const had=!!pendingId;doubleTap.reset();pendingId=undefined;confirmation.hidden=true;grid.preview(null);return had;}
 function confirmCandidate(){if(!pendingId||paused()||mode!=='field')return;const id=pendingId;doubleTap.reset();if(grid.activate(id)){pendingId=undefined;confirmation.hidden=true;}}
 confirmButton.onclick=confirmCandidate;cancelButton.onclick=()=>clearCandidate();
 function cancelMove(){clearCandidate();if(!selectingMove)return false;selectingMove=false;canceling=true;const restored=grid.cancelReopen();canceling=false;onMoveCanceled();return restored;}
 function hover(id:string|null){if(pendingId||paused()||mode!=='field')return;const index=id?view?.state.field.indexOf(id):-1;grid.preview(index!==undefined&&index>=0&&fieldRecords.get(index)?.pickable&&(!selectingMove||index!==selectedIndex)?id:null);}
 function updateSelectionControls(camera:THREE.Camera){
  if(!pendingId||!root.visible||paused()||mode!=='field'){confirmation.hidden=true;return;}
  const index=view?.state.field.indexOf(pendingId),tile=index===undefined?undefined:tileByIndex.get(index);if(!tile){clearCandidate();return;}
  const project=(point:THREE.Vector3)=>{point.y=height(point.x,point.z)+.08;point.project(camera);return{x:(point.x+1)*innerWidth/2,y:(1-point.y)*innerHeight/2,z:point.z};};
  const center=project(tile.center.clone()),ends=[-1,1].map(sign=>project(tile.center.clone().addScaledVector(GRID_RIGHT,sign*WORLD_GRID_CARD.width*.5))).sort((a,b)=>a.x-b.x);
  confirmation.hidden=center.z<-1||center.z>1;if(confirmation.hidden)return;
  [confirmButton,cancelButton].forEach((button,i)=>{const edge=ends[i],dx=edge.x-center.x,dy=edge.y-center.y,length=Math.max(1,Math.hypot(dx,dy)),x=THREE.MathUtils.clamp(edge.x+dx/length*36,26,innerWidth-26),y=THREE.MathUtils.clamp(edge.y+dy/length*36,26,innerHeight-26);button.style.left=x+'px';button.style.top=y+'px';const line=connectors[i];line.style.left=edge.x+'px';line.style.top=edge.y+'px';line.style.width=Math.hypot(x-edge.x,y-edge.y)+'px';line.style.transform=`rotate(${Math.atan2(y-edge.y,x-edge.x)}rad)`;});
 }
 const coverage=tiles.reduce((sum,t)=>sum+t.area,0)/gridPolygonArea(boundary);
 return {root,grid,pickTargets,get active(){return view?.phase==='play';},get selectedPoint(){return selectedPoint;},get selectingMove(){return selectingMove;},get busy(){return jumping||!['field','folded'].includes(mode);},get inFlight(){return jumping;},
  setCardValidator(handler:typeof canCard){canCard=handler;},setMoveViewHandler(handler:()=>void){requestView=handler;},setMoveCanceledHandler(handler:()=>void){onMoveCanceled=handler;},
  requestMove(){if(paused()||jumping||mode!=='folded'||!grid.reopen())return false;selectingMove=true;requestView();return true;},cancelMove,
  cardAt(hit:THREE.Intersection){return hit.object===floor?fieldRecords.get(owners[hit.faceIndex??-1])?.id:(hit.object.userData.worldGridCard as {id?:string}|undefined)?.id;},
  setJumpHandler(handler:(point:THREE.Vector3)=>boolean){requestJump=handler;},setJumping(value:boolean){jumping=value;},
  hover,clearCandidate,updateSelectionControls,
  resetDoubleTap(){doubleTap.reset();},
  updatePanel(camera:THREE.Camera,naviEnabled:boolean){
   const hint=naviEnabled&&view?.phase==='play'?grid.bestSequence():undefined;
   panel.update(view,root.visible&&['folded','receipt'].includes(mode),paused()||jumping||mode!=='folded',camera,id=>displays.get(id)?.card.to.clone(),hint?.kind==='card'?hint.id:undefined);
   if(mode==='folded'||mode==='receipt'){for(const d of displays.values())d.mesh.visible=false;stock.visible=false;}
  },
  get panelVisible(){return panel.visible;},naviScreenTarget(id:string){return panel.cardCenter(id);},
  paintPanel(source:HTMLCanvasElement,now:number){panel.paint(source,now);},
  naviDestination(hero?:THREE.Vector3){
   const preferred=view?.phase==='pick'&&hero?[...fieldRecords.values()].sort((a,b)=>Math.hypot(a.center[0]-hero.x,a.center[2]-hero.z)-Math.hypot(b.center[0]-hero.x,b.center[2]-hero.z))[0]?.id:undefined;
   const excluded=selectingMove&&selectedIndex!==undefined?view?.state.field[selectedIndex]??undefined:undefined,hint=grid.bestSequence(excluded,preferred);
   if(hint.kind==='return')return {...hint,point:selectedPoint?.clone()};
   const display=hint.id?displays.get(hint.id):undefined,field=[...fieldRecords.values()].find(c=>c.id===hint.id);
   const point=view?.phase==='play'&&mode!=='landing'&&display?(display.mesh.userData.center as THREE.Vector3|undefined)?.clone()??display.card.to.clone():field?new THREE.Vector3(...field.center):undefined;
   return {...hint,point};
  },
  select(id:string){if(paused()||jumping||!['field','folded'].includes(mode)){doubleTap.reset();return false;}if(view?.phase==='pick'){const index=view.state.field.indexOf(id);if(!fieldRecords.get(index)?.pickable||selectingMove&&index===selectedIndex){doubleTap.reset();return false;}const confirm=doubleTap.tap(id);pendingId=id;grid.preview(id);if(confirm)confirmCandidate();return true;}return grid.activate(id);},
  update(visible:boolean,dt=0){
   root.visible=visible;if(!visible){cancelMove();return;}if(paused()){clearCandidate();if(selectingMove)cancelMove();}
   if(mode==='landing'&&!jumping){mode='in';elapsed=0;maskField(true);}
   if(mode==='in'||mode==='out'||mode==='receipt'){
    elapsed+=dt;const p=worldGridFoldProgress(elapsed,mode==='receipt'?.3:1.15,reduced.matches);amount=mode==='out'?1-p:p;
    fieldUniform.value=mode==='receipt'?1:amount;
    for(const d of displays.values())positionDisplay(d,amount);positionStock(amount);
    if(p===1){if(mode==='out'){mode='field';maskField(false);floor.visible=true;for(const d of displays.values())d.mesh.visible=false;}else{mode='folded';floor.visible=false;for(const d of displays.values())d.mesh.visible=d.card.visible;}updatePickTargets();}
   }else if(mode==='field')positionStock(0);
  },
  get rankSurfaces(){return panel.visible?[]:[...displays.values()].filter(d=>d.card.active).map(d=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>{const p=d.card.to.clone().addScaledVector(GRID_RIGHT,x*WORLD_GRID_CARD.width*.21).addScaledVector(GRID_DOWN,y*WORLD_GRID_CARD.height*.17);p.y=height(p.x,p.z)+.061;return p;}));},
  get diagnostics(){const folded=[...displays.values()].filter(d=>d.card.visible).map(d=>({id:d.card.id,rank:d.card.rank,index:d.card.coordinateIndex,coordinate:worldGridCoordinate(d.card.coordinateIndex),center:d.card.to.toArray(),foundation:d.card.foundation,active:d.card.active,peek:d.card.peek}));return {space:'world',phase:view?.phase,fold:{state:mode,amount,faces:folded.filter(c=>!c.peek).length,backfill:folded.filter(c=>c.peek).length},selectingMove,panelVisible:panel.visible,candidate:pendingId,preview:Object.fromEntries(Object.entries(view?.layout??{}).filter(([,p])=>p.pv).map(([id,p])=>[id,p.pv])),cardWidth:WORLD_GRID_CARD.width,gap:WORLD_GRID_CARD.gap,coverage,batched:true,cards:mode==='field'||mode==='landing'?[...fieldRecords.values()].map(c=>({...c,coordinate:worldGridCoordinate(c.index)})):folded,fieldCards:[...fieldRecords.values()].map(c=>({...c,coordinate:worldGridCoordinate(c.index)})),selected:selectedPoint?.toArray(),visible:root.visible};},
  dispose(){panel.dispose();confirmation.remove();grid.dispose();for(const d of displays.values()){d.mesh.geometry.dispose();d.mesh.material.dispose();}floorGeometry.dispose();stockGeometry.dispose();material.dispose();texture.dispose();addressTexture.dispose();root.removeFromParent();}
 };
}


