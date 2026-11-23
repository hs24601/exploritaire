import {LUSTRO_ART,lustroFacePosition,type LustroFaceId} from './lustroExpressions';
import './lustroSticker.css';
/** Reusable sticker: original-alpha body and independently selected face. */
export function LustroSticker({face='confident',className=''}:{face?:LustroFaceId;className?:string}){return <span className={`lustro-sticker ${className}`} role="img" aria-label={`Lustro, ${face}`}><img src={LUSTRO_ART+'body.png'} alt="" draggable={false}/><span data-lustro-face={face} style={{backgroundImage:`url("${LUSTRO_ART}faces.png")`,backgroundPosition:lustroFacePosition(face)}}/></span>;}
