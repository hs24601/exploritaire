import { validBookStep, type BookCameraStep } from './bookCamera';
export type BookShotNode=BookCameraStep&{id:string;/** set on in-between shots made by Connect the dots: the end shot they lead into */bridge?:string};
export type BookSceneNode={id:string;name:string;page:number;shots:BookShotNode[]};
export type BookChapter={id:string;name:string;scenes:BookSceneNode[]};
export type BookSceneDocument={version:1;revision:number;chapters:BookChapter[]};
export type BookSelection={kind:'chapter'|'scene'|'shot';id:string};
export const bookNodeId=()=>crypto.randomUUID();
export function validBookDocument(value:unknown):value is BookSceneDocument{
 const d=value as BookSceneDocument,ids=new Set<string>();let scenes=0,shots=0;
 const node=(n:{id:string;name:string})=>!!n&&typeof n.id==='string'&&/^[\w-]{1,100}$/.test(n.id)&&!ids.has(n.id)&&!!ids.add(n.id)&&typeof n.name==='string'&&!!n.name.trim()&&n.name.length<=120;
 return !!d&&d.version===1&&Number.isInteger(d.revision)&&d.revision>=0&&Array.isArray(d.chapters)&&d.chapters.length<=50&&d.chapters.every(c=>node(c)&&Array.isArray(c.scenes)&&c.scenes.every(s=>++scenes<=200&&node(s)&&Number.isInteger(s.page)&&s.page>=0&&s.page<=5&&Array.isArray(s.shots)&&s.shots.every(t=>++shots<=1000&&node(t)&&validBookStep(t))));
}
export function findBookNode(doc:BookSceneDocument,selection:BookSelection){
 for(const chapter of doc.chapters){if(selection.kind==='chapter'&&chapter.id===selection.id)return {node:chapter,chapter};for(const scene of chapter.scenes){if(selection.kind==='scene'&&scene.id===selection.id)return {node:scene,chapter,scene};for(const shot of scene.shots)if(selection.kind==='shot'&&shot.id===selection.id)return {node:shot,chapter,scene,shot};}}
 return undefined;
}
export function moveBookShot(doc:BookSceneDocument,shotId:string,sceneId:string,beforeId?:string){
 const source=findBookNode(doc,{kind:'shot',id:shotId}),destination=findBookNode(doc,{kind:'scene',id:sceneId});
 if(!source?.shot||!source.scene||!destination?.scene||beforeId===shotId)return false;
 if(beforeId&&!destination.scene.shots.some(s=>s.id===beforeId))return false;
 source.scene.shots.splice(source.scene.shots.findIndex(s=>s.id===shotId),1);const index=beforeId?destination.scene.shots.findIndex(s=>s.id===beforeId):destination.scene.shots.length;destination.scene.shots.splice(index,0,source.shot);return true;
}
export function copyBookNode<T extends BookChapter|BookSceneNode|BookShotNode>(node:T,name:string):T{
 const copy=structuredClone(node);const rekey=(value:BookChapter|BookSceneNode|BookShotNode)=>{value.id=bookNodeId();if('scenes'in value)value.scenes.forEach(rekey);if('shots'in value)value.shots.forEach(rekey);};rekey(copy);copy.name=name;return copy;
}

/** Insert a new sibling immediately after its source, atomically. */
export function insertBookCopy(doc:BookSceneDocument,selection:BookSelection,name:string){
 const next=structuredClone(doc),entry=findBookNode(next,selection);if(!entry)throw Error('The selected item no longer exists.');
 const copy=copyBookNode(entry.node,name);
 if(entry.shot&&entry.scene)entry.scene.shots.splice(entry.scene.shots.indexOf(entry.shot)+1,0,copy as BookShotNode);
 else if(entry.scene)entry.chapter.scenes.splice(entry.chapter.scenes.indexOf(entry.scene)+1,0,copy as BookSceneNode);
 else next.chapters.splice(next.chapters.indexOf(entry.chapter)+1,0,copy as BookChapter);
 if(!validBookDocument(next))throw Error('The copy exceeds the scene document limits.');
 return {document:next,selection:{kind:selection.kind,id:copy.id} as BookSelection};
}
