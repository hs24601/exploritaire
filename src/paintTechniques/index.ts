export {compileLuminanceSvg,LuminanceReveal,rankLuminance,type LuminanceOptions,type SvgAudit} from './luminanceSvg';
export const PAINT_TECHNIQUES=[
 {id:'ink-spread-sprite',name:'Ink-spread sprite',medium:'Raster / Three.js',description:'A 40-frame alpha mask spreads pigment across sketch artwork; used by the book reveal.'},
 {id:'svg-luminance-buckets',name:'Luminance-ordered SVG',medium:'Traced SVG paths',description:'Compile into 100 luminance-ranked buckets, then reveal light-to-dark or dark-to-light with seeded jitter.'}
] as const;
