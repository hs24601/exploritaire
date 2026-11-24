import { useId } from 'react';
const EXPRESSIONS = ['happy','sad','upset','upsetWithSymbol','stars','heartEyes','blush','neutral','fighting'] as const;
type Expression = typeof EXPRESSIONS[number];
const SHEETS = {
 dem: {url:'/assets/runtime/characters/dem/dem-expressions-v1.png',width:1293,height:1217,x:[0,440,850,1293],y:[0,399,789,1190]},
 cir: {url:'/assets/runtime/keru/cir/cir-expressions-v2.png',width:1254,height:1254,x:[0,418,836,1254],y:[0,418,836,1254]},
};

/** Clip the authored sheet to one expression, preserving its original paint and alpha. */
export function KeruExpression({keru,emotion,label,demi=false}:{keru:'dem'|'cir';emotion:Expression;label:string;demi?:boolean}) {
 const clip=useId();
 if (keru==='dem' && demi) {
  const cells: Record<Expression, number> = { happy:5, sad:6, upset:8, upsetWithSymbol:8, stars:10, heartEyes:2, blush:4, neutral:5, fighting:9 };
  const index=cells[emotion], x=(index%4)*362, y=Math.floor(index/4)*362;
  return <svg viewBox="20 -32 362 362" data-demi-expression="true" role="img" aria-label={label} data-keru-expression={emotion} style={{width:'100%',height:'100%',overflow:'hidden',pointerEvents:'none'}}><defs><clipPath id={clip}><rect width="362" height="362"/></clipPath></defs><g clipPath={`url(#${clip})`}><image href={`${import.meta.env.BASE_URL}assets/runtime/characters/dem/demi-expressions-v1.png`} x={-x} y={-y} width="1448" height="1086"/></g></svg>;
 }
 const sheet=SHEETS[keru],index=EXPRESSIONS.indexOf(emotion),col=index%3,row=Math.floor(index/3);
 const x=sheet.x[col],y=sheet.y[row],w=sheet.x[col+1]-x,h=sheet.y[row+1]-y;
 return <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} data-keru-expression={emotion}
  style={{width:'100%',height:'100%',overflow:'hidden',pointerEvents:'none'}}>
  <defs><clipPath id={clip}><rect width={w} height={h}/></clipPath></defs>
  <g clipPath={`url(#${clip})`}><image href={sheet.url} x={-x} y={-y} width={sheet.width} height={sheet.height}/></g>
 </svg>;
}

