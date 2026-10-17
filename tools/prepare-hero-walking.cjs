// Asset preparation: measure alpha cutouts and pack immutable generated pixels.
const fs = require('node:fs');
const {chromium} = require('playwright');
(async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage(), measurements = {};
    for (const tier of ['low','high']) {
      const data = fs.readFileSync(`public/assets/actors/sources/hero-walking-${tier}-source-v1.png`).toString('base64');
      const result = await page.evaluate(async ({data,rows}) => {
        const image=new Image();image.src='data:image/png;base64,'+data;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
        const rgba=ctx.getImageData(0,0,image.width,image.height).data;
        // Faint generated halos can bridge neighbouring rows; identify the solid
        // silhouettes first, then retain only each one's own alpha fringe.
        const visited=new Uint8Array(image.width*image.height),queue=new Int32Array(visited.length),owners=new Int32Array(visited.length),components=[];
        for(let start=0;start<visited.length;start++) if(!visited[start]&&rgba[start*4+3]>128){
          let read=0,count=1,left=image.width,right=0,top=image.height,bottom=0;queue[0]=start;visited[start]=1;
          while(read<count){
            const p=queue[read++],x=p%image.width,y=Math.floor(p/image.width);
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
            for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
              if(!(dx||dy)||x+dx<0||x+dx>=image.width||y+dy<0||y+dy>=image.height)continue;
              const next=p+dy*image.width+dx;
              if(!visited[next]&&rgba[next*4+3]>128){visited[next]=1;queue[count++]=next;}
            }
          }
          if(count>1000){const id=components.length+1;for(let i=0;i<count;i++)owners[queue[i]]=id;components.push({rect:[left,top,right-left+1,bottom-top+1],count,id});}
        }
        if(components.length!==rows*4)throw new Error(`Expected ${rows*4} cutouts; found ${components.length}; corners ${rgba[3]},${rgba[(image.width-1)*4+3]}; bounds ${JSON.stringify(components)}`);
        components.sort((a,b)=>(a.rect[1]+a.rect[3]/2)-(b.rect[1]+b.rect[3]/2));
        const ordered=Array.from({length:rows},(_,row)=>components.slice(row*4,row*4+4).sort((a,b)=>a.rect[0]-b.rect[0]));
        const sourceRects=ordered.map(row=>row.map(c=>c.rect));
        const pad=24,cellW=Math.max(...components.map(c=>c.rect[2]))+pad*2,cellH=Math.max(...components.map(c=>c.rect[3]))+pad*2;
        const packed=document.createElement('canvas');packed.width=cellW*4;packed.height=cellH*rows;
        const out=packed.getContext('2d');out.imageSmoothingEnabled=false;
        const rects=sourceRects.map((row,r)=>{
          const w=Math.max(...row.map(rect=>rect[2]))+2,h=Math.max(...row.map(rect=>rect[3]))+2;
          return row.map(([x,y,sw,sh],phase)=>{
            const left=phase*cellW+Math.floor((cellW-w)/2),top=r*cellH+cellH-pad-h;
            const own=ordered[r][phase].id,cut=ctx.getImageData(x,y,sw,sh);
            for(let cy=0;cy<sh;cy++)for(let cx=0;cx<sw;cx++){
              const p=(y+cy)*image.width+x+cx,index=(cy*sw+cx)*4;
              let keep=owners[p]===own;
              if(!keep&&!owners[p]&&rgba[p*4+3]<=128){
                for(let dy=-2;dy<=2&&!keep;dy++)for(let dx=-2;dx<=2&&!keep;dx++){
                  if(x+cx+dx>=0&&x+cx+dx<image.width&&y+cy+dy>=0&&y+cy+dy<image.height)keep=owners[p+dy*image.width+dx]===own;
                }
              }
              if(!keep)cut.data[index+3]=0;
            }
            out.putImageData(cut,left+Math.round((w-sw)/2),top+h-sh-1);
            // Equal phase rectangles preserve per-view pixel scale and foot baseline.
            return [left,top,w,h];
          });
        });
        return {width:packed.width,height:packed.height,sourceRects,rects,alphaCorners:[rgba[3],rgba[(image.width-1)*4+3]],atlas:packed.toDataURL('image/png').split(',')[1]};
      },{data,rows:tier==='low'?5:6});
      fs.writeFileSync(`public/assets/actors/battle/hero-walking-${tier}-v1.png`,Buffer.from(result.atlas,'base64'));
      delete result.atlas;measurements[tier]=result;
    }
    const metadata=JSON.stringify(measurements,null,2)+'\n';
    fs.writeFileSync('src/proto/art/heroWalkingLayout.json',metadata);
    fs.writeFileSync('public/assets/actors/battle/hero-walking-layout.json',metadata);
    console.log(JSON.stringify(measurements,null,2));
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});

