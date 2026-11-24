import {DEFAULT_POPUP, type PopupSettings} from './pageDocument';

/** Authored starting points only; inserted controls retain editable page data. */
export const BOOK_POPUP_PRESETS:Record<string,{name:string;width:number;height:number;popup:PopupSettings}>={
 'environment/watercolor/v1/hero-den-sprite-v2.png':{
  name:"Hero's den",width:3.6,height:2.2,
  // The frontal arch straddles the central crease; a broad card supports the low silhouette.
  popup:{...DEFAULT_POPUP,split:.5,cardWidth:4.2,cardDepth:3.2},
 },
};
