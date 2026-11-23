import type { EditorEntity } from './actorEditorCatalog';
export type KeruTextEdits = Record<string, { name: string; description: string; tags?: string[] }>;
/** Readable URL aliases follow editable names; original IDs remain stable for assets and drafts. */
export const keruSlug = (name:string) => name.normalize('NFKC').trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'');
export function keruUrlKey(entity:EditorEntity, entities:readonly EditorEntity[], edits:KeruTextEdits):string {
 const base=keruSlug(edits[entity.id]?.name ?? entity.name) || entity.id;
 const conflict=entities.some(other=>other.id!==entity.id && (other.id===base || (keruSlug(edits[other.id]?.name ?? other.name) || other.id)===base));
 return conflict ? `${base}--${entity.id}` : base;
}
export function resolveKeruKey(key:string | null, entities:readonly EditorEntity[], edits:KeruTextEdits):string {
 if(!key)return entities[0].id;
 return (entities.find(entity=>entity.id===key) ?? entities.find(entity=>keruUrlKey(entity,entities,edits)===key))?.id ?? entities[0].id;
}
