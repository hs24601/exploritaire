const fs=require('fs'),{chromium}=require('playwright');
const root='public/assets/runtime/characters/hero/platforming/idle-v2',source='public/assets/sources/characters/hero/platforming/idle-v2';
(async()=>{const records=JSON.parse(fs.readFileSync('docs/art/hero-idle-v2-selected.json')),browser=await chromium.launch({headless:true});try{
 const page=await browser.newPage(),clips=[];for(const record of records.clips){
  const packed=await page.evaluate(async({b64,id,columns,rows})=>{
   const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();
   const raw=document.createElement('canvas');raw.width=im.width;raw.height=im.height;const input=raw.getContext('2d',{willReadFrequently:true});input.drawImage(im,0,0);
   const cell=384,scale=cell*.88/Math.max(im.width/columns,im.height/rows),out=document.createElement('canvas');out.width=cell*8;out.height=cell;const ctx=out.getContext('2d'),frames=[],pngs=[];
   for(let i=0;i<8;i++){
    const index=id==='blink'?(i<4?0:1):i,col=index%columns,row=Math.floor(index/columns),x=Math.round(col*im.width/columns),y=Math.round(row*im.height/rows),w=Math.round((col+1)*im.width/columns)-x,h=Math.round((row+1)*im.height/rows)-y;
    const pixels=input.getImageData(x,y,w,h).data;let sum=0,cx=0,cy=0,x0=w,y0=h,x1=-1,y1=-1,edge=0,opaque=0,clear=0;
    for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++){const a=pixels[(yy*w+xx)*4+3];if(!a)clear++;if(a>245)opaque++;if(a>32){sum+=a;cx+=xx*a;cy+=yy*a;x0=Math.min(x0,xx);y0=Math.min(y0,yy);x1=Math.max(x1,xx);y1=Math.max(y1,yy);if(xx<2||yy<2||xx>=w-2||yy>=h-2)edge++;}}
    if(!sum)throw Error('Empty cell: '+id+' '+i);cx/=sum;cy/=sum;const pivot=id==='butterfly'?[cx,cy]:[cx,y1],target=id==='butterfly'?[192,192]:[192,345.6];let dx=target[0]-pivot[0]*scale,dy=target[1]-pivot[1]*scale;
    dx=Math.max(6-x0*scale,Math.min(dx,378-(x1+1)*scale));dy=Math.max(6-y0*scale,Math.min(dy,378-(y1+1)*scale));
    ctx.drawImage(im,x,y,w,h,i*cell+dx,dy,w*scale,h*scale);const frame=document.createElement('canvas');frame.width=frame.height=cell;frame.getContext('2d').drawImage(out,i*cell,0,cell,cell,0,0,cell,cell);pngs.push(frame.toDataURL().split(',')[1]);
    frames.push({index:i,rect:{x:i*cell,y:0,width:cell,height:cell},pivot:{x:(pivot[0]*scale+dx)/cell,y:(pivot[1]*scale+dy)/cell},paintBounds:{x:x0*scale+dx,y:y0*scale+dy,width:(x1-x0+1)*scale,height:(y1-y0+1)*scale},sourceEdgePixels:edge,opaqueCorePixels:opaque,clearPixels:clear});
   }
   return {png:out.toDataURL().split(',')[1],pngs,frames,sourceSize:[im.width,im.height]};
  },{b64:fs.readFileSync(source+'/'+record.id+'-source.png').toString('base64'),id:record.id,columns:record.grid?.columns??4,rows:record.grid?.rows??2});
  fs.mkdirSync(root+'/frames/'+record.id,{recursive:true});fs.writeFileSync(root+'/'+record.id+'.png',Buffer.from(packed.png,'base64'));packed.pngs.forEach((p,i)=>fs.writeFileSync(root+'/frames/'+record.id+'/'+i+'.png',Buffer.from(p,'base64')));
  clips.push({id:record.id,image:record.id+'.png',fps:8,loop:true,authoredFrames:record.id==='blink'?2:8,frameSize:{width:384,height:384},sourceSize:packed.sourceSize,frames:packed.frames});console.log(record.id+': '+packed.frames.filter(f=>f.sourceEdgePixels).length+' cells touching source edges');
 }
 fs.writeFileSync(root+'/manifest.json',JSON.stringify({version:2,character:'Hero',generator:'built-in ImageGen',clips},null,2)+'\n');
 const preview=await page.evaluate(async clips=>{const c=document.createElement('canvas');c.width=1600;c.height=clips.length*190+70;const x=c.getContext('2d');x.fillStyle='#1a302c';x.fillRect(0,0,c.width,c.height);x.fillStyle='#efdfb7';x.font='28px Georgia';x.fillText('Hero · idle v2 · open breaths / two-eye keys / playful rests',22,40);for(let row=0;row<clips.length;row++){let im=new Image();im.src='data:image/png;base64,'+clips[row].png;await im.decode();x.font='17px Georgia';x.fillStyle='#efdfb7';x.fillText(clips[row].id,16,115+row*190);for(let i=0;i<8;i++)x.drawImage(im,i*384,0,384,384,200+i*170,65+row*190,170,170);}return c.toDataURL().split(',')[1];},clips.map(c=>({id:c.id,png:fs.readFileSync(root+'/'+c.image).toString('base64')})));
 fs.mkdirSync('artifacts/hero-idle-v2',{recursive:true});fs.writeFileSync('artifacts/hero-idle-v2/contact-sheet.png',Buffer.from(preview,'base64'));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
