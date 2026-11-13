import {useId,type ReactNode} from 'react';
import {heroLoaderSvg} from './heroLoaderSvg';
import './HeroLoader.css';
export function HeroLoaderArt({className='',decorative=false}:{className?:string;decorative?:boolean}){
 const id=useId().replace(/[^a-zA-Z0-9_-]/g,'');
 return <span className={`hero-loader__art ${className}`} aria-hidden={decorative||undefined} dangerouslySetInnerHTML={{__html:heroLoaderSvg('loader-'+id)}}/>;
}
export function HeroLoading({children,className=''}:{children:ReactNode;className?:string}){
 return <div className={`hero-loading ${className}`} role="status"><HeroLoaderArt decorative/><span>{children}</span></div>;
}
