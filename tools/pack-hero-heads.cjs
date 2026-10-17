// Pack existing painted heads and generated neutral heads; never repaint bodies.
const fs=require('node:fs');
const {chromium}=require('playwright');
const out='public/assets/actors/hero/heads-watercolor-v2';
(async()=>{const b=await chromium.launch();try{
 const p=await b.newPage();
 const neutral=fs.readFileSync(out+'/hero-neutral-source-v2.png').toString('base64');
 const sad=['low','high'].map(t=>fs.readFileSync(`output/imagegen/hero-faces-v1/hero-sitting-sad-${t}-source.png`).toString('base64'));
 const result=await p.evaluate(async({neutral,sad})=>{
  const load=async(data)=>{const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();return i;};
  const n=await load(neutral),s=await Promise.all(sad.map(load));
  const bounds=(img,rect)=>{const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const g=c.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,c.width,c.height).data;const [x,y,w,h]=rect;let l=x+w,t=y+h,r=x,b=y;for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++)if(d[(py*c.width+px)*4+3]>128){l=Math.min(l,px);t=Math.min(t,py);r=Math.max(r,px);b=Math.max(b,py);}return [l,t,r-l+1,b-t+1];};
  const outputs={};
  for(const emotion of ['sad','neutral']){
   const c=document.createElement('canvas');c.width=1024;c.height=512;const g=c.getContext('2d');const rects=[];
   for(let tier=0;tier<2;tier++)for(let angle=0;angle<4;angle++){
    const img=emotion==='neutral'?n:s[tier];
    let src;
    if(emotion==='neutral'){const cw=img.width/4,ch=img.height/2;src=bounds(img,[Math.floor(angle*cw),Math.floor(tier*ch),Math.floor(cw),Math.floor(ch)]);}
    else {const index=angle, col=index%3,row=Math.floor(index/3),cw=img.width/3,ch=img.height/3;const body=bounds(img,[Math.floor(col*cw),Math.floor(row*ch),Math.floor(cw),Math.floor(ch)]);src=[body[0],body[1],body[2],Math.round(body[3]*(angle===0?.55:angle===1?.55:angle===2?.53:.43))];}
    src=bounds(img,src);
    const scale=Math.min(224/src[2],224/src[3]),w=Math.round(src[2]*scale),h=Math.round(src[3]*scale),x=angle*256+Math.round((256-w)/2),y=tier*256+Math.round((256-h)/2);
    g.drawImage(img,...src,x,y,w,h);
    if(emotion==='sad') {
      // Cropped source heads need a soft neck join, never a straight atlas edge.
      const pixels=g.getImageData(x,y,w,h);
      for(let py=0;py<h;py++)for(let px=0;px<w;px++){
        const fade=Math.min(1,(h-1-py)/(h*.14));
        pixels.data[(py*w+px)*4+3]*=Math.max(0,fade);
      }
      g.putImageData(pixels,x,y);
    }
    rects.push([x,y,w,h]);
   }
   outputs[emotion]={png:c.toDataURL('image/png').split(',')[1],rects};
  }
  return outputs;
 },{neutral,sad});
 const manifest={};for(const [emotion,data]of Object.entries(result)){fs.writeFileSync(`${out}/hero-${emotion}-heads-v2.png`,Buffer.from(data.png,'base64'));manifest[emotion]=data.rects;}
 fs.writeFileSync('src/proto/art/heroHeadLayout.json',JSON.stringify(manifest,null,2)+'\n');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

