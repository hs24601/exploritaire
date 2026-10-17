// Non-destructive packing: retain every existing expression asset and measurement.
const fs=require('node:fs');const {chromium}=require('playwright');
const root='public/assets/actors/hero/heads-watercolor-v2';
(async()=>{const b=await chromium.launch();try{
 const p=await b.newPage(),data=fs.readFileSync(root+'/hero-curious-source-v1.png').toString('base64');
 const result=await p.evaluate(async data=>{
  const img=new Image();img.src='data:image/png;base64,'+data;await img.decode();
  const raw=document.createElement('canvas');raw.width=img.width;raw.height=img.height;
  const rg=raw.getContext('2d');rg.drawImage(img,0,0);const rgba=rg.getImageData(0,0,raw.width,raw.height).data;
  const out=document.createElement('canvas');out.width=1024;out.height=512;const g=out.getContext('2d'),rects=[];
  for(let row=0;row<2;row++)for(let col=0;col<4;col++){
   const x0=Math.floor(col*img.width/4),x1=Math.floor((col+1)*img.width/4),y0=Math.floor(row*img.height/2),y1=Math.floor((row+1)*img.height/2);
   let l=x1,t=y1,r=x0,b=y0;
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(rgba[(y*img.width+x)*4+3]>128){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
   if(r<=l||b<=t)throw Error('Missing curious head');
   const sw=r-l+1,sh=b-t+1,scale=Math.min(224/sw,224/sh),w=Math.round(sw*scale),h=Math.round(sh*scale),x=col*256+Math.round((256-w)/2),y=row*256+Math.round((256-h)/2);
   g.drawImage(img,l,t,sw,sh,x,y,w,h);rects.push([x,y,w,h]);
  }
  return {png:out.toDataURL('image/png').split(',')[1],rects};
 },data);
 fs.writeFileSync(root+'/hero-curious-heads-v1.png',Buffer.from(result.png,'base64'));
 fs.writeFileSync('src/proto/art/heroCuriousHeadLayout.json',JSON.stringify(result.rects,null,2)+'\n');
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
