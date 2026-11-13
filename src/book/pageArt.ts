import * as THREE from 'three';
import { BOOK_SCENES } from './scenes';

export const STORY_FONT = '"Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
export const MAP_STOPS = [{ x: -3.9, z: .6 }, { x: -.9, z: -1.35 }, { x: 3.2, z: -.75 }];

export function paperTexture(draw: (ctx: CanvasRenderingContext2D) => void, width = 1600, height = 1024) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function pagePlane(texture: THREE.Texture, width: number, depth: number, x: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  mesh.rotation.x = -Math.PI / 2; mesh.position.set(x, .154, z); mesh.renderOrder = 2;
  return mesh;
}

export function storyTexture(text: string, page: number) {
  return paperTexture(ctx => {
    ctx.fillStyle='#f0e2c2';ctx.fillRect(0,0,1600,420);
    ctx.strokeStyle = '#a68b5666'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(100, 22); ctx.lineTo(1500, 22); ctx.stroke();
    ctx.fillStyle = '#493e2d'; ctx.font = `italic 80px ${STORY_FONT}`;
    const words = text.split(' '); let line = '', y = 95;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > 1400) { ctx.fillText(line, 100, y); y += 86; line = word; } else line = test;
    }
    ctx.fillText(line, 100, y);
    ctx.font = `32px ${STORY_FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#8a7654'; ctx.fillText(String(page), 800, 390);
  }, 1600, 420);
}

export function mapTexture() {
  return paperTexture(ctx => {
    const ink = '#65543a'; ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 2;
    // Faint graticule, incomplete coastlines and engraved hatching on parchment.
    ctx.globalAlpha = .12;
    for (let x = 70; x < 1600; x += 110) { ctx.beginPath();ctx.moveTo(x,80);ctx.bezierCurveTo(x-35,350,x+35,700,x,950);ctx.stroke(); }
    for (let y = 100; y < 1000; y += 110) { ctx.beginPath();ctx.moveTo(60,y);ctx.quadraticCurveTo(800,y-45,1540,y);ctx.stroke(); }
    ctx.globalAlpha = 1;
    ctx.strokeRect(42,42,1516,940);ctx.strokeRect(53,53,1494,918);
    ctx.font = `small-caps 52px ${STORY_FONT}`;ctx.textAlign='center';ctx.fillText('The Marches of Aldan',800,119);
    ctx.font = `italic 23px ${STORY_FONT}`;ctx.fillText('Being an imperfect account of the known country',800,158);
    ctx.beginPath();ctx.moveTo(80,260);ctx.bezierCurveTo(250,210,170,430,360,460);ctx.bezierCurveTo(530,510,180,650,380,770);ctx.bezierCurveTo(480,850,300,860,220,920);ctx.stroke();
    for(let i=0;i<22;i++){const y=280+i*28;ctx.beginPath();ctx.moveTo(80+(i%3)*13,y);ctx.lineTo(135+(i%3)*12,y-12);ctx.stroke();}
    ctx.save();ctx.translate(125,610);ctx.rotate(-Math.PI/2);ctx.font=`italic 32px ${STORY_FONT}`;ctx.fillText('The Unwritten Sea',0,0);ctx.restore();
    // Ink mountains and little woodland symbols are intentionally cartographic.
    for(let i=0;i<15;i++){const x=940+(i%5)*80,y=245+Math.floor(i/5)*66;ctx.beginPath();ctx.moveTo(x-28,y+32);ctx.lineTo(x,y-25);ctx.lineTo(x+36,y+32);ctx.moveTo(x,y-25);ctx.lineTo(x+8,y+12);ctx.lineTo(x+30,y+28);ctx.stroke();}
    for(let i=0;i<30;i++){const x=360+(i%10)*60,y=290+Math.floor(i/10)*66;ctx.beginPath();ctx.moveTo(x,y+20);ctx.lineTo(x,y-15);ctx.moveTo(x-13,y+5);ctx.lineTo(x,y-25);ctx.lineTo(x+13,y+5);ctx.stroke();}
    ctx.font=`italic 29px ${STORY_FONT}`;ctx.fillText('The Hushed Wood',630,265);ctx.fillText('The Pale Teeth',1170,205);
    const points=MAP_STOPS.map(p=>({x:(p.x+5.65)/11.3*1600,y:(p.z+3.45)/5.55*1024}));
    ctx.setLineDash([5,12]);ctx.beginPath();ctx.moveTo(points[0].x,points[0].y);ctx.bezierCurveTo(500,790,520,400,points[1].x,points[1].y);ctx.bezierCurveTo(900,610,1060,500,points[2].x,points[2].y);ctx.stroke();ctx.setLineDash([]);
    points.forEach((p,i)=>{ctx.beginPath();ctx.arc(p.x,p.y,12,0,Math.PI*2);ctx.stroke();ctx.font=`26px ${STORY_FONT}`;ctx.fillText(BOOK_SCENES[i].name,p.x,p.y+45);});
    // Sixteen-point compass rose and scale bar.
    const cx=1290,cy=775;
    for(let i=0;i<16;i++){const a=i*Math.PI/8,r=i%4===0?90:i%2===0?60:35;ctx.beginPath();ctx.moveTo(cx+Math.cos(a-.14)*14,cy+Math.sin(a-.14)*14);ctx.lineTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);ctx.lineTo(cx+Math.cos(a+.14)*14,cy+Math.sin(a+.14)*14);if(i%2===0)ctx.fill();else ctx.stroke();}
    ctx.font=`28px ${STORY_FONT}`;ctx.fillText('N',cx,cy-105);
    ctx.beginPath();ctx.moveTo(560,895);ctx.lineTo(920,895);for(let i=0;i<5;i++){ctx.moveTo(560+i*90,885);ctx.lineTo(560+i*90,905);}ctx.stroke();ctx.font=`italic 22px ${STORY_FONT}`;ctx.fillText('A day’s walk, if the roads are kind',740,935);
  });
}

export function bookmarkTexture(symbol: string, color: string) {
  return paperTexture(ctx=>{
    ctx.fillStyle=color;ctx.fillRect(0,0,512,128);ctx.strokeStyle='#e3d3a188';ctx.strokeRect(12,10,488,108);
    if(symbol==='map'){
      ctx.strokeStyle='#f0e2c2';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(365,38);ctx.lineTo(392,28);ctx.lineTo(419,40);ctx.lineTo(446,30);ctx.lineTo(446,88);ctx.lineTo(419,98);ctx.lineTo(392,86);ctx.lineTo(365,96);ctx.closePath();ctx.moveTo(392,28);ctx.lineTo(392,86);ctx.moveTo(419,40);ctx.lineTo(419,98);ctx.stroke();return;
    }
    ctx.fillStyle='#f0e2c2';ctx.font=`64px ${STORY_FONT}`;ctx.textAlign='center';ctx.fillText(symbol,405,88);
  },512,128);
}
