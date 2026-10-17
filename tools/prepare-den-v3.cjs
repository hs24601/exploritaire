// Integrate the generated atlas with pixel-preserving crops and the existing south-facing source convention.
const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{const browser=await chromium.launch();try{
  const page=await browser.newPage();
  const outputs=await page.evaluate(async source=>{
    const image=new Image();image.src=source;await image.decode();
    const read=document.createElement('canvas');read.width=image.width;read.height=image.height;
    const ctx=read.getContext('2d');ctx.drawImage(image,0,0);
    const raster=ctx.getImageData(0,0,image.width,image.height),data=raster.data;
    // A game pixel is either solid ink or outside the silhouette. Generated
    // soft-alpha fringe otherwise exposes the table at the joining edges.
    for(let i=3;i<data.length;i+=4)data[i]=data[i]>100?255:0;
    ctx.putImageData(raster,0,0);
    return [0,1].map(panel=>{
      let left=image.width,right=-1,top=image.height,bottom=-1;
      // The atlas has a transparent gutter between its unequal-width panels.
      const start=panel?1040:0,end=panel?image.width:1020;
      for(let y=0;y<image.height;y++)for(let x=start;x<end;x++)if(data[(y*image.width+x)*4+3]>100){
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      if(!panel){
        // Trim the atlas's antialiased fringe to the continuous rock rectangle,
        // rather than preserving a transparent gutter on the three joining edges.
        const solid=(x,y)=>data[(y*image.width+x)*4+3]===255;
        const span=right-left+1;
        for(let y=bottom;y>=top;y--){
          let count=0;for(let x=left;x<=right;x++)if(solid(x,y))count++;
          if(count/span>.95){bottom=y;break;}
        }
        const joinTop=Math.floor(bottom-(bottom-top)*.4);
        let commonLeft=left,commonRight=right;
        for(let y=joinTop;y<=bottom;y++){
          let a=left,b=right;while(a<=b&&!solid(a,y))a++;while(b>=a&&!solid(b,y))b--;
          commonLeft=Math.max(commonLeft,a);commonRight=Math.min(commonRight,b);
        }
        left=commonLeft;right=commonRight;
      }
      const out=document.createElement('canvas');out.width=128;out.height=panel?104:128;
      const paint=out.getContext('2d');paint.imageSmoothingEnabled=false;
      if(!panel)paint.setTransform(-1,0,0,-1,128,128);
      paint.drawImage(image,left,top,right-left+1,bottom-top+1,0,0,out.width,out.height);
      const final=paint.getImageData(0,0,out.width,out.height);
      for(let i=3;i<final.data.length;i+=4)final.data[i]=final.data[i]>100?255:0;
      paint.putImageData(final,0,0);
      return out.toDataURL('image/png').split(',')[1];
    });
  },'data:image/png;base64,'+fs.readFileSync('public/assets/biomes/sources/hero-den-atlas-v3.png').toString('base64'));
  ['hero-den-topdown-v3.png','hero-den-standee-v3.png'].forEach((name,i)=>fs.writeFileSync('public/assets/biomes/'+name,Buffer.from(outputs[i],'base64')));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
