import * as THREE from 'three';
import {createPopupVFold,type PopupVFold,type PopupVFoldOptions} from './popupVFold';
import {paintedPaperPanel} from './paperCutout';

/** Two paintings on one engineered V-fold: tree, branch and cat are clipped at
 * the same crease and glued to the same rigid leaves. There is no independently
 * floating cat, second base card, or separate animation clock. */
export function createTreePerchPopup(tree:HTMLCanvasElement,cat:HTMLCanvasElement,o:PopupVFoldOptions):PopupVFold{
 const main=createPopupVFold(tree,o),catHeight=o.height*.36,catWidth=catHeight*cat.width/cat.height,split=.22;
 const seat=o.height*.42,branchY=seat+catHeight*.4,thickness=o.thickness??.008;
 const panels:ReturnType<typeof paintedPaperPanel>[]=[],branches:THREE.Mesh[]=[];
 const paint=new THREE.CanvasTexture(tree);paint.colorSpace=THREE.SRGBColorSpace;
 const branchMaterial=new THREE.MeshStandardMaterial({map:paint,color:'#b99465',roughness:1,side:THREE.DoubleSide});
 for(const [i,frame]of main.leaves!.entries()){
  const side=i===0?1:-1,panel=paintedPaperPanel(cat,catHeight,thickness,o.backColor??'#efe4cc',side>0?split:0,side>0?1:split);
  panel.group.position.set((.5-split)*catWidth,seat,thickness*2.5);panel.group.name='mochi-perch-paint';frame.add(panel.group);panels.push(panel);
  // A continuous forked branch blank bridges the two art layers. Its pigment
  // samples the existing pine trunk; the original paintings remain untouched.
  const reach=catWidth*(side>0?.82:.23),shape=new THREE.Shape();
  shape.moveTo(0,-.045);shape.lineTo(side*reach,-.025);shape.lineTo(side*reach,0);shape.lineTo(side*reach*.73,.065);shape.lineTo(side*reach*.42,.025);shape.lineTo(0,.07);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:false}),p=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  for(let j=0;j<p.count;j++)uv.setXY(j,.49+p.getY(j)*.15,.06+Math.abs(p.getX(j))/Math.max(.01,reach)*.13);
  const branch=new THREE.Mesh(geometry,branchMaterial);branch.position.set(0,branchY,thickness*1.7);branch.castShadow=branch.receiveShadow=true;frame.add(branch);branches.push(branch);
 }
 // Editor hit volume includes the raised companion, not just the original tree.
 const bounds=new THREE.BoxGeometry(Math.max(main.width,catWidth*1.3,o.cardWidth),o.height,o.cardDepth);
 bounds.translate(0,o.height/2,-o.cardDepth/2+.25);main.hit.geometry.dispose();main.hit.geometry=bounds;
 main.root.userData.treePerch=true;main.root.userData.connectedPaper=true;
 main.driver.userData.connectedPaper=true;
 const originalPose=main.pose;
 function pose(n:number){originalPose(n);main.root.userData.perchOpen=n;}
 main.driver.userData.kirigami={pose};pose(1);
 return {...main,width:Math.max(main.width,catWidth*1.3),pose,dispose(){panels.forEach(p=>p.dispose());branches.forEach(b=>b.geometry.dispose());branchMaterial.dispose();paint.dispose();main.dispose();}};
}
