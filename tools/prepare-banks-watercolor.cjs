// Pack coherent Banks paintings into the exact existing Hero rig registrations.
const fs=require('node:fs'),{chromium}=require('playwright');
const version=process.argv[2]||'v2';
if(!/^v\d+$/.test(version))throw Error('Expected version such as v3');
const sitting=require('../src/proto/art/heroSittingLayout.json');
const walking=require('../src/proto/art/heroWalkingLayout.json');
const combat=require('../src/proto/art/heroCombatLayout.json');
const specs={
 'directions-low':{width:1122,height:1402,rects:[[48,20,206,251],[41,289,272,248],[19,546,321,254],[25,812,291,256],[55,1080,183,273]],cols:1},
 'directions-high':{width:1024,height:1536,rects:[[44,43,194,228],[44,274,242,228],[28,509,286,242],[41,753,258,254],[71,1022,174,398]],cols:1},
 ...Object.fromEntries(['low','high'].flatMap(tier=>[
  [`sitting-${tier}`,{...sitting[tier],cols:3}],
  [`walking-${tier}`,{...walking[tier],rects:walking[tier].rects.flat(),cols:4}],
 ])),
 ...Object.fromEntries(['flinch','down'].map(pose=>[`${pose}-atlas`,{...combat[pose],cols:3}])),
};
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||undefined});try{const page=await browser.newPage(),report={};
 for(const [name,spec]of Object.entries(specs)){
 const result=await page.evaluate(async({data,spec,name})=>{
  const image=new Image();image.src=data;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const cx=c.getContext('2d');cx.drawImage(image,0,0);
  const rgba=cx.getImageData(0,0,c.width,c.height).data,n=c.width*c.height,seen=new Uint8Array(n),labels=new Int32Array(n),q=new Int32Array(n),bodies=[];let id=0;
  for(let start=0;start<n;start++)if(!seen[start]&&rgba[start*4+3]>128){let read=0,count=1,l=c.width,r=0,t=c.height,b=0;q[0]=start;seen[start]=1;id++;
   while(read<count){const p=q[read++],x=p%c.width,y=Math.floor(p/c.width);labels[p]=id;l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
    for(const d of [-1,1,-c.width,c.width]){const next=p+d;if(next<0||next>=n||d===-1&&!x||d===1&&x===c.width-1)continue;if(!seen[next]&&rgba[next*4+3]>128){seen[next]=1;q[count++]=next;}}}
   if(count>800)bodies.push({l,r,t,b,id,count});}
  if(bodies.length!==spec.rects.length)throw Error(`${name}: expected ${spec.rects.length} bodies, found ${bodies.length}`);
  bodies.sort((a,b)=>(a.t+a.b)-(b.t+b.b));const ordered=[];for(let row=0;row<bodies.length/spec.cols;row++)ordered.push(...bodies.slice(row*spec.cols,(row+1)*spec.cols).sort((a,b)=>a.l-b.l));
  const output=document.createElement('canvas');output.width=spec.width;output.height=spec.height;const out=output.getContext('2d');out.imageSmoothingQuality='high';
  const scale=Math.min(...ordered.map((b,i)=>Math.min((spec.rects[i][2]-8)/(b.r-b.l+7),(spec.rects[i][3]-8)/(b.b-b.t+7))));
  const frames=ordered.map((b,i)=>{const sx=Math.max(0,b.l-3),sy=Math.max(0,b.t-3),w=Math.min(c.width,b.r+4)-sx,h=Math.min(c.height,b.b+4)-sy;
   const isolated=document.createElement('canvas');isolated.width=w;isolated.height=h;const ic=isolated.getContext('2d'),ip=ic.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){const p=(sy+y)*c.width+sx+x;let keep=labels[p]===b.id;
    if(!keep&&rgba[p*4+3]>0)for(let dy=-3;dy<=3&&!keep;dy++)for(let dx=-3;dx<=3;dx++){const xx=sx+x+dx,yy=sy+y+dy;if(xx>=0&&xx<c.width&&yy>=0&&yy<c.height&&labels[yy*c.width+xx]===b.id){keep=true;break;}}
    if(keep)for(let k=0;k<4;k++)ip.data[(y*w+x)*4+k]=rgba[p*4+k];}
   ic.putImageData(ip,0,0);const [x,y,tw,th]=spec.rects[i],dw=w*scale,dh=h*scale;out.drawImage(isolated,x+(tw-dw)/2,y+th-4-dh,dw,dh);return {source:[sx,sy,w,h],rect:spec.rects[i],scale};});
  const pixels=out.getImageData(0,0,output.width,output.height).data;let transparent=0,partial=0;for(let i=3;i<pixels.length;i+=4){if(!pixels[i])transparent++;else if(pixels[i]<255)partial++;}if(!transparent||!partial)throw Error('Missing watercolor RGBA');
  return {png:output.toDataURL('image/png').split(',')[1],width:output.width,height:output.height,frames,transparent,partial};
 },{data:'data:image/png;base64,'+fs.readFileSync(`public/assets/sources/characters/banks-watercolor-${version}/${name}-source.png`).toString('base64'),spec,name});
 const path=`public/assets/runtime/characters/banks/rig/watercolor/${version}/banks-${name}-watercolor-${version}.png`;fs.mkdirSync(`public/assets/runtime/characters/banks/rig/watercolor/${version}`,{recursive:true});fs.writeFileSync(path,Buffer.from(result.png,'base64'));delete result.png;report[name]={path,...result};console.log(name,result.frames.length,'frames');}
 fs.writeFileSync(`docs/art/banks-watercolor-${version}-packing.json`,JSON.stringify(report,null,2)+'\n');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
