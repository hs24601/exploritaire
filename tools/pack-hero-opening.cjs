// Pack generated cutouts onto the existing registration grids; retain sources.
const fs = require('node:fs');
const { chromium } = require('playwright');
const root = 'public/assets/runtime/characters/hero/poses/watercolor/v1-opening';
const sourceRoot = 'public/assets/sources/characters/hero/poses/watercolor/v1-opening';
const sitting = require('../src/proto/art/heroSittingLayout.json');
const walking = require('../src/proto/art/heroWalkingLayout.json');
const standing = {
  low: [[48,20,206,251],[41,289,272,248],[19,546,321,254],[25,812,291,256],[55,1080,183,273]],
  high: [[44,43,194,228],[44,274,242,228],[28,509,286,242],[41,753,258,254],[71,1022,174,398]],
};
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const jobs = ['happy','curious','sad'].map(emotion=>({ name:`${emotion}-heads`, cols:4, rows:2, width:1024, height:512, rects:[] }));
    for (const tier of ['low','high']) {
      jobs.push({name:`sitting-${tier}`,cols:3,rows:3,...sitting[tier]});
      jobs.push({name:`directions-${tier}`,cols:1,rows:5,rects:standing[tier],template:`public/assets/runtime/characters/hero/rig/watercolor/v3/hero-directions-${tier}-body-v3.png`, narrow:true});
      jobs.push({name:`walking-${tier}`,cols:4,rows:tier==='low'?5:6,...walking[tier],rects:walking[tier].rects.flat()});
    }
    for (const job of jobs) {
      const refined = `${sourceRoot}/hero-${job.name}-source-v2.png`;
      const source = fs.existsSync(refined) ? refined : `${sourceRoot}/hero-${job.name}-source-v1.png`;
      if (!fs.existsSync(source)) continue;
      const result = await page.evaluate(async ({job,data,template}) => {
        const load = async data => { const i=new Image();i.src='data:image/png;base64,'+data;await i.decode();return i; };
        const image = await load(data), reference=template ? await load(template) : null;
        const raw=document.createElement('canvas');raw.width=image.width;raw.height=image.height;
        const read=raw.getContext('2d');read.drawImage(image,0,0);
        const pixels=read.getImageData(0,0,raw.width,raw.height).data;
        const canvas=document.createElement('canvas');canvas.width=reference?.width??job.width;canvas.height=reference?.height??job.height;
        const ctx=canvas.getContext('2d'),rects=[];
        // Find whole connected silhouettes before splitting the grid. Generated
        // gutters vary slightly; fixed cell crops can cut paws or copy a sliver
        // from the previous row into the next head.
        const seen=new Uint8Array(image.width*image.height),components=[];
        for(let start=0;start<seen.length;start++){
          if(seen[start]||pixels[start*4+3]<=128)continue;
          const stack=[start];seen[start]=1;let left=image.width,top=image.height,right=0,bottom=0,count=0;
          while(stack.length){const index=stack.pop(),x=index%image.width,y=Math.floor(index/image.width);count++;
            left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
            for(const next of [x>0?index-1:-1,x+1<image.width?index+1:-1,y>0?index-image.width:-1,y+1<image.height?index+image.width:-1])
              if(next>=0&&!seen[next]&&pixels[next*4+3]>128){seen[next]=1;stack.push(next);}
          }
          if(count>100)components.push({left,top,right,bottom,count});
        }
        const selected=components.sort((a,b)=>b.count-a.count).slice(0,job.rows*job.cols).sort((a,b)=>(a.top+a.bottom)-(b.top+b.bottom));
        if(selected.length!==job.rows*job.cols)throw Error(`Missing silhouettes in ${job.name}`);
        const ordered=[];
        for(let row=0;row<job.rows;row++)ordered.push(...selected.slice(row*job.cols,(row+1)*job.cols).sort((a,b)=>a.left-b.left));
        for(let row=0;row<job.rows;row++)for(let col=0;col<job.cols;col++){
          let {left,top,right,bottom}=ordered[row*job.cols+col];
          // Include the translucent painted fringe rather than clipping at its core.
          left=Math.max(0,left-4);top=Math.max(0,top-4);right=Math.min(image.width-1,right+4);bottom=Math.min(image.height-1,bottom+4);
          const sw=right-left+1,sh=bottom-top+1,index=row*job.cols+col;
          const target=job.rects[index]??[col*256+16,row*256+16,224,224];
          const factor=Math.min(target[2]/sw,target[3]/sh),w=Math.round(sw*factor),h=Math.round(sh*factor);
          const x=target[0]+Math.round((target[2]-w)/2),y=target[1]+target[3]-h;
          ctx.drawImage(image,left,top,sw,sh,x,y,w,h);rects.push([x,y,w,h]);
        }
        let emoji;
        if(job.name.endsWith('-heads')) {
          const [x,y,w,h]=rects[0],front=document.createElement('canvas');front.width=w;front.height=h;
          front.getContext('2d').drawImage(canvas,x,y,w,h,0,0,w,h);
          emoji=front.toDataURL('image/png').split(',')[1];
        }
        return {png:canvas.toDataURL('image/png').split(',')[1],rects,emoji};
      }, {job,data:fs.readFileSync(source).toString('base64'),template:job.template?fs.readFileSync(job.template).toString('base64'):null});
      fs.writeFileSync(`${root}/hero-${job.name}-v1.png`,Buffer.from(result.png,'base64'));
      if(job.name.endsWith('-heads')) {
        const emotion=job.name.split('-')[0];
        fs.writeFileSync(`${root}/hero-${emotion}-emoji-v1.png`,Buffer.from(result.emoji,'base64'));
        const layout=emotion==='happy'?'heroHappyHeadLayout':`heroOpening${emotion[0].toUpperCase()+emotion.slice(1)}HeadLayout`;
        fs.writeFileSync(`src/proto/art/${layout}.json`,JSON.stringify(result.rects,null,2)+'\n');
      }
      console.log(`Packed ${job.name}: ${result.rects.length} cutouts`);
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
