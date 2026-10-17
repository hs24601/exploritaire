// Repack four complete paired paintings; one shared crop/scale avoids pose jitter.
const fs=require('node:fs'),{chromium}=require('playwright');
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage();
 const result=await page.evaluate(async data=>{
  const image=new Image();image.src=data;await image.decode();
  const source=document.createElement('canvas');source.width=image.width;source.height=image.height;
  const ctx=source.getContext('2d');ctx.drawImage(image,0,0);
  const cells=[];let left=Infinity,top=Infinity,right=0,bottom=0;
  for(let i=0;i<4;i++){
   const sx=Math.round(i%2*image.width/2),sy=Math.round(Math.floor(i/2)*image.height/2);
   const w=Math.round((i%2+1)*image.width/2)-sx,h=Math.round((Math.floor(i/2)+1)*image.height/2)-sy;
   const pixels=ctx.getImageData(sx,sy,w,h);let count=0,transparent=0,partial=0;
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const alpha=pixels.data[(y*w+x)*4+3];if(!alpha)transparent++;else if(alpha<250)partial++;if(alpha>8){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}}
   if(count<1000||!transparent||!partial)throw Error('Missing paired artwork/alpha in frame '+i);
   if(!pixels.data.some((value,index)=>index%4===3&&value>=250))throw Error('Missing solid paint in frame '+i);
   cells.push({sx,sy,w,h,count,transparent,partial});
  }
  left=Math.max(0,left-4);top=Math.max(0,top-4);right=Math.min(Math.min(...cells.map(cell=>cell.w)),right+5);bottom=Math.min(Math.min(...cells.map(cell=>cell.h)),bottom+5);
  const width=right-left,height=bottom-top,scale=Math.min(728/width,600/height);
  const sheet=document.createElement('canvas');sheet.width=3072;sheet.height=640;
  const out=sheet.getContext('2d');out.imageSmoothingQuality='high';
  const dw=width*scale,dh=height*scale;
  cells.forEach((cell,i)=>out.drawImage(source,cell.sx+left,cell.sy+top,width,height,i*768+(768-dw)/2,620-dh,dw,dh));
  return {png:sheet.toDataURL('image/png').split(',')[1],source:[image.width,image.height],frame:[768,640],crop:[left,top,width,height],scale,cells};
 },'data:image/png;base64,'+fs.readFileSync('public/assets/actors/cinema/sources/banks-hero-nuzzle-v2-source.png').toString('base64'));
 fs.writeFileSync('public/assets/actors/cinema/banks-hero-nuzzle-v2.png',Buffer.from(result.png,'base64'));delete result.png;
 fs.writeFileSync('docs/art/banks-rescue-nuzzle-v2-packing.json',JSON.stringify(result,null,2)+'\n');console.log(result);
}finally{await browser.close();}})().catch(error=>{console.error(error);process.exit(1)});
