import { TileTableauPreview } from './TileTableauPreview';
import { EditorTabs, useEditorDrag } from '../components/EditorWorkspace';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TABLE_GRID, type GridCell } from '../gridCoordinates';
import { TILE_KINDS, coversCell, newAuthoredTile, validateTileDocument, type AuthoredTile, type TileDocument, type TileKind } from './schema';
import './TileEditor.css';

let recentTiles: AuthoredTile[] = [];
const tileSignature = ({ id, column, row, ...template }: AuthoredTile) => JSON.stringify(template);

type Props = { workspace?: boolean; renderTableaus?: (tile: AuthoredTile | null) => React.ReactNode; tools?: React.ReactNode; contextMenu?: { cell: GridCell; x: number; y: number } | null; onDismissMenu?: () => void; document: TileDocument; cell: GridCell; onSelectCell: (cell: GridCell) => void;
  onChange: (document: TileDocument) => void; onApply: (document: TileDocument) => void; onClose: () => void };
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

export function TileEditor({ workspace = false, renderTableaus, tools, document, cell, onSelectCell, onChange, onApply, onClose, contextMenu, onDismissMenu }: Props) {
  const floating = useEditorDrag();
  const [section, setSection] = useState('Tiles');
  const [component, setComponent] = useState(workspace ? 'Identity' : 'Selection');
  const menuRef = useRef<HTMLDivElement>(null);
  const choices = [...recentTiles, ...TILE_KINDS.filter(kind => kind !== 'hero-den').map(kind => newAuthoredTile(kind, 0, 0, `template-${kind}`))].filter((tile, i, all) => all.findIndex(other => tileSignature(other) === tileSignature(tile)) === i).slice(0, 5);
  useEffect(() => {
    if (!contextMenu) return;
    const dismiss = (event: PointerEvent) => { if (!menuRef.current?.contains(event.target as Node)) onDismissMenu?.(); };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') onDismissMenu?.(); };
    window.document.addEventListener('pointerdown', dismiss, true);
    window.document.addEventListener('keydown', key);
    const close = () => onDismissMenu?.();
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    window.document.addEventListener('wheel', close, true);
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => { window.document.removeEventListener('pointerdown', dismiss, true); window.document.removeEventListener('keydown', key); window.removeEventListener('resize', close); window.removeEventListener('blur', close); window.document.removeEventListener('wheel', close, true); };
  }, [contextMenu, onDismissMenu]);
  const selected = document.tiles?.find(tile => coversCell(tile, cell.column, cell.row));
  const [tile, setTile] = useState<AuthoredTile | null>(selected ? copy(selected) : null);
  const [kind, setKind] = useState<TileKind>('woods');
  const [history, setHistory] = useState<TileDocument[]>([]);
  const [future, setFuture] = useState<TileDocument[]>([]);
  const [status, setStatus] = useState('Select a cell on the table, or choose a tile below. Gameplay is paused.');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [defaultKind, setDefaultKind] = useState<TileKind>('woods');
  const [profile, setProfile] = useState(document.defaults.woods);
  useEffect(() => { setTile(selected ? copy(selected) : null); setError(''); }, [selected, cell.column, cell.row]);
  useEffect(() => { setProfile({ ...document.defaults[defaultKind] }); }, [document.defaults, defaultKind]);

  const commit = (next: TileDocument, message: string) => {
    try {
      validateTileDocument(next);
      setHistory(previous => [...previous.slice(-49), copy(document)]); setFuture([]);
      const used = next.tiles?.filter(tile => tile.kind !== 'hero-den' && JSON.stringify(document.tiles?.find(old => old.id === tile.id)) !== JSON.stringify(tile)) ?? [];
      for (const tile of used) recentTiles = [copy(tile), ...recentTiles.filter(old => tileSignature(old) !== tileSignature(tile))].slice(0, 5);
      onChange(next); setError(''); setStatus(message);
      return true;
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid tile data'); return false; }
  };
  const update = (patch: Partial<AuthoredTile>) => setTile(previous => previous ? { ...previous, ...patch } : null);
  const saveTile = () => tile && commit({ ...document, tiles: document.tiles!.map(entry => entry.id === tile.id ? copy(tile) : entry) }, 'Tile updated in the draft preview.');
  const protectedDen = tile?.id === 'hero-den';
  const uniqueId = (prefix: string) => {
    let id = prefix, suffix = 2;
    while (document.tiles!.some(entry => entry.id === id)) id = `${prefix}-${suffix++}`;
    return id;
  };
  const makeCopy = () => {
    if (!tile || protectedDen) return;
    const next = { ...copy(tile), id: uniqueId(`${tile.id}-copy`) };
    if (commit({ ...document, tiles: [...document.tiles!, next] }, 'Tile duplicated in the draft preview.')) onSelectCell(TABLE_GRID.cell(next.column, next.row));
  };
  const dirtyForm = tile && JSON.stringify(tile) !== JSON.stringify(selected);
  const dirtyProfile = JSON.stringify(profile) !== JSON.stringify(document.defaults[defaultKind]);
  const prepareDocument = () => {
    const next = {
      ...document,
      tiles: dirtyForm && tile ? document.tiles!.map(entry => entry.id === tile.id ? copy(tile) : entry) : document.tiles,
      defaults: dirtyProfile ? { ...document.defaults, [defaultKind]: { ...profile } } : document.defaults,
    };
    validateTileDocument(next);
    if ((dirtyForm || dirtyProfile) && !commit(next, 'Pending edits updated in the draft preview.')) throw new Error('Unable to update pending edits');
    return next;
  };
  const exportJson = () => {
    try {
    const next = prepareDocument();
    const url = URL.createObjectURL(new Blob([JSON.stringify(next, null, 2) + '\n'], { type: 'application/json' }));
    const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = 'protoTiles.json'; anchor.click();
    URL.revokeObjectURL(url);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to export authored data'); }
  };
  return <>{contextMenu && createPortal(<div ref={menuRef} data-editor-safe="true" className="tile-editor-quick-menu" role="menu" aria-label="Recently used tiles" style={{ left: Math.max(8, Math.min(contextMenu.x, window.innerWidth - 240)), top: Math.max(8, Math.min(contextMenu.y, window.innerHeight - 280)) }}>
    <small>Recently used tiles</small>
    {choices.map((template, index) => <button key={index} type="button" role="menuitem" onClick={() => {
      const target = contextMenu.cell;
      const next = { ...copy(template), id: uniqueId(`tile-${template.kind}-${target.column}-${target.row}`), column: target.column, row: target.row };
      if (commit({ ...document, tiles: [...document.tiles!, next] }, 'Tile added to the draft preview.')) { onSelectCell(target); onDismissMenu?.(); }
    }}>{template.title}</button>)}
    <button type="button" onClick={onDismissMenu}>Cancel</button>
  </div>, window.document.body)}{createPortal(<aside ref={node => { floating.ref.current = node; }} style={floating.style} data-editor-safe="true" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onWheel={e => e.stopPropagation()} className={`tile-editor ${workspace ? 'tile-editor--workspace' : ''}`} aria-label="Developer tile editor" data-camera-ignore="true">
    <div className="tile-editor-heading editor-drag-handle" {...floating.handle}><div><small>PROTO AUTHORING</small><h2>Tiles &amp; tableaus</h2></div><button type="button" onClick={onClose} disabled={saving} aria-label="Close tile editor">×</button></div>
    <div className="editor-command-bar">      <button disabled={saving} onClick={() => { try { onApply(prepareDocument()); setError(''); setStatus('Applied to this playtest. Close the editor to resume. Disk data has not changed.'); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to apply'); } }}>{workspace ? 'Apply tiles to playtest' : 'Apply to playtest'}</button>
      <button disabled={saving} onClick={async () => {
        try {
          const next = prepareDocument(); setSaving(true); setError(''); setStatus('Saving authored tile data…');
          const response = await fetch('/__proto-deprecated/pixel/tiles/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) });
          if (!response.ok) throw new Error(await response.text());
          const result = await response.json(); if (result.saved !== true) throw new Error('The development save endpoint is unavailable');
          setStatus('Saved to src/data/protoTiles.json. The development server reloads the game with the authored layout.');
        } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to save authored data'); }
        finally { setSaving(false); }
      }}>{workspace ? 'Save tile data' : 'Save authored data'}</button>
      <button disabled={saving} onClick={exportJson}>{workspace ? 'Export tile JSON' : 'Export authored JSON'}</button>
      <label className="tile-editor-import">Import tile JSON<input aria-label="Import tile JSON" disabled={saving} type="file" accept=".json,application/json" onChange={async event => {
        const file=event.target.files?.[0]; event.target.value=''; if(!file)return;
        try { const next=JSON.parse(await file.text()); validateTileDocument(next); if(!next.tiles)throw new Error('Import requires a complete tile layout'); if(commit(next,'Imported tile draft. Apply or save to use it.'))onSelectCell(TABLE_GRID.cell(0,2)); }
        catch(reason){setError(reason instanceof Error ? reason.message : 'Invalid tile JSON');}
      }} /></label>
      <button type="button" onClick={() => window.open(`${import.meta.env.BASE_URL}tools/watercolor-lab.html`, '_blank', 'noopener')}>Watercolor lab</button>
      <button disabled={saving} onClick={onClose}>Close · playtest applied data</button></div>
    <div className="tile-editor-context">    <label>Choose tile<select aria-label="Choose tile" value={selected?.id ?? ''} onChange={event => { const entry = document.tiles!.find(t => t.id === event.target.value); if (entry) onSelectCell(TABLE_GRID.cell(entry.column, entry.row)); }}>
      <option value="">Empty cell</option>{document.tiles!.map(entry => <option value={entry.id} key={entry.id}>{entry.title} · {entry.column},{entry.row}</option>)}
    </select></label><p className="tile-editor-current"><strong>{tile?.title ?? 'Empty cell'}</strong> · {TABLE_GRID.reference(cell)}{tile && ' · '+tile.kind}</p></div>
    <EditorTabs names={['Tiles', 'Terrain defaults', ...(renderTableaus ? ['Tableaus'] : []), ...(tools ? ['Tools'] : [])]} value={section} onChange={setSection} label="Editor tools" />
    <div hidden={section !== 'Tableaus'}>{renderTableaus?.(tile)}</div><div hidden={section !== 'Tools'}>{tools}</div><div hidden={section !== 'Tiles'}>

    <EditorTabs names={['Selection', 'Identity', 'Travel', 'Resources', 'Rules', 'Lighting']} value={component} onChange={setComponent} label="Tile components" />
    <div className="tile-editor-selection" hidden={component !== 'Selection'}><p>Full terrain preview · gameplay paused. Changes below stay in a draft until applied or saved.</p>
    <div className="tile-editor-actions">
      <button disabled={!history.length || saving} onClick={() => { const previous = history[history.length - 1]; setFuture(items => [copy(document), ...items]); setHistory(items => items.slice(0, -1)); onChange(previous); setStatus('Draft change undone.'); }}>Undo edit</button>
      <button disabled={!future.length || saving} onClick={() => { const next = future[0]; setHistory(items => [...items, copy(document)]); setFuture(items => items.slice(1)); onChange(next); setStatus('Draft change restored.'); }}>Redo edit</button>
    </div>
    <label>Selected cell<input readOnly value={TABLE_GRID.reference(cell)} /></label>

    <div className="tile-editor-actions">
      <label>Column<input aria-label="Select column" type="number" min="-7" max="7" value={cell.column} onChange={event => { const col = Number(event.target.value); if (Number.isInteger(col) && Math.abs(col) <= 7) onSelectCell(TABLE_GRID.cell(col, cell.row)); }} /></label>
      <label>Row<input aria-label="Select row" type="number" min="-7" max="7" value={cell.row} onChange={event => { const row = Number(event.target.value); if (Number.isInteger(row) && Math.abs(row) <= 7) onSelectCell(TABLE_GRID.cell(cell.column, row)); }} /></label>
    </div>
    </div>{!tile ? <section><h3>Add terrain</h3><label>Terrain<select value={kind} onChange={event => setKind(event.target.value as TileKind)}>{TILE_KINDS.filter(k => k !== 'hero-den').map(k => <option key={k}>{k}</option>)}</select></label>
      <button onClick={() => commit({ ...document, tiles: [...document.tiles!, newAuthoredTile(kind, cell.column, cell.row, uniqueId(`tile-${kind}-${cell.column}-${cell.row}`))] }, 'Tile added to the draft preview.')}>Add tile</button></section>
      : <form noValidate onSubmit={event => { event.preventDefault(); saveTile(); }}>
        <h3>Cell properties</h3>
        <div hidden={component !== 'Identity'}><label>Tile ID<input readOnly value={tile.id} /></label>
        <label>Title<input value={tile.title} maxLength={120} onChange={event => update({ title: event.target.value })} /></label>
        <label>Terrain<select value={tile.kind} disabled={protectedDen} onChange={event => {
          const next = newAuthoredTile(event.target.value as TileKind, tile.column, tile.row, tile.id);
          setTile({ ...next, title: tile.title, initiallyRevealed: tile.initiallyRevealed });
        }}>{TILE_KINDS.filter(k => k !== 'hero-den' || protectedDen).map(k => <option key={k}>{k}</option>)}</select></label>
        <div className="tile-editor-actions">
          <label>Destination column<input aria-label="Tile column" disabled={protectedDen} type="number" min="-7" max="7" value={tile.column} onChange={event => update({ column: Number(event.target.value) })} /></label>
          <label>Destination row<input aria-label="Tile row" disabled={protectedDen} type="number" min="-7" max="7" value={tile.row} onChange={event => update({ row: Number(event.target.value) })} /></label>
        </div>
        <div className="tile-editor-actions">
          <label>Width in cells<input type="number" min="1" max="15" disabled={protectedDen} value={tile.gridSize.columns} onChange={event => update({ gridSize: { ...tile.gridSize, columns: Number(event.target.value) } })} /></label>
          <label>Depth in cells<input type="number" min="1" max="15" disabled={protectedDen} value={tile.gridSize.rows} onChange={event => update({ gridSize: { ...tile.gridSize, rows: Number(event.target.value) } })} /></label>
        </div>
        </div><div hidden={component !== 'Travel'}><label>STA per orthogonal cell override<input type="number" min="0" max="100" step="0.1" disabled={protectedDen} placeholder={`Inherit ${document.defaults[tile.kind].traversalDifficulty}`} value={tile.traversalDifficulty ?? ''} onChange={event => update({ traversalDifficulty: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
        <label>Travel cards per cell override<input type="number" min="1" max="100" placeholder={`Inherit ${document.defaults[tile.kind].travelCards}`} value={tile.travelCards ?? ''} onChange={event => update({ travelCards: event.target.value === '' ? undefined : Number(event.target.value) })} /></label>
        {!protectedDen && <><label>Directional crossing<select aria-label="Directional crossing" value={tile.passage?.axis??''} onChange={event=>update({passage:event.target.value?{axis:event.target.value as 'east-west'|'north-south',title:tile.passage?.title??'Hastily Buried Trapdoor',tags:tile.passage?.tags??['buried'],columns:tile.passage?.columns??7,breachAP:tile.passage?.breachAP??1}:undefined})}><option value="">None</option><option value="east-west">East ↔ West</option><option value="north-south">North ↔ South</option></select></label>{tile.passage && <>
        <label>Obstruction title<input value={tile.passage.title} onChange={event=>update({passage:{...tile.passage!,title:event.target.value}})} /></label>
        <label>Obstruction tags (comma separated)<input value={tile.passage.tags.join(',')} onChange={event=>update({passage:{...tile.passage!,tags:event.target.value.split(',').map(t=>t.trim().replace(/^#/,''))}})} /></label>
        <label>Columns after breach<input type="number" min="1" max="10" value={tile.passage.columns} onChange={event=>update({passage:{...tile.passage!,columns:Number(event.target.value)}})} /></label>
        <label>Breach AP<input type="number" min="1" max="100" value={tile.passage.breachAP} onChange={event=>update({passage:{...tile.passage!,breachAP:Number(event.target.value)}})} /></label>
        </>}</>}
        {renderTableaus && <button type="button" onClick={() => setSection('Tableaus')}>Edit travel tableau layout</button>}
        <p>Blank overrides inherit terrain defaults. Travel layouts override the inherited card count. Zero STA still uses card-driven crossings.</p>
        </div><div hidden={component !== 'Resources'}>{tile.kind === 'berry-patch' && <label className="tile-editor-check"><input type="checkbox" checked={tile.berryPatchVariant === 'sparse'} onChange={event => update({ berryPatchVariant: event.target.checked ? 'sparse' : undefined,
          ...(event.target.checked ? { populationDensity: 1, tableauSize: 0, opensTableauOnArrival: false } : { tableauSize: 28, opensTableauOnArrival: undefined }) })} />Sparse patch · one bush, one travel manaberry</label>}
        <label>Population density (0–10)<input type="number" min="0" max="10" step="1" disabled={tile.berryPatchVariant === 'sparse'} value={tile.populationDensity ?? (tile.kind === 'woods' ? 3 : tile.kind === 'berry-patch' ? 2 : 0)} onChange={event => update({ populationDensity: Number(event.target.value) })} /></label>
        <label>Resource density<input type="number" min="0" max="1" step="0.05" disabled={protectedDen || !['woods'].includes(tile.kind)} value={tile.resourceDensity} onChange={event => update({ resourceDensity: Number(event.target.value) })} /></label>
        <label>Gathering deal size<input type="number" min="0" max="51" disabled={protectedDen || tile.kind !== 'woods'} value={tile.tableauSize} onChange={event => update({ tableauSize: Number(event.target.value) })} /></label>
        <p>{tile.kind === 'hero-den' ? 'Den rest: six columns of five cards, plus 22 stock cards (one initially revealed). Plays restore inspiration. Travel layout assignments do not change rest.' : tile.kind === 'water' ? 'Ponds use Proto fishing, with no gathering tableau.' : tile.berryPatchVariant === 'sparse' ? 'Sparse patches have no gathering deal: the finite manaberry is earned by completing travel.' : tile.kind === 'berry-patch' ? 'Dense patches use Proto’s finite manaberry generator. Scripted days supply their own finite gathering deals.' : tile.kind === 'path' ? 'Paths use the resource-free 13-card arrival deal.' : tile.kind === 'woods' ? 'Woods use these resource-density and deal-size values in Proto’s gathering generator. Travel layout assignments are separate.' : tile.passage ? 'The passage exposes its crossing after a legal breach. No gathering deal.' : 'This terrain has no gathering deal.'}</p>
        {component === 'Resources' && <TileTableauPreview tile={tile} document={document} />}
        </div><div hidden={component !== 'Rules'}><label>Threat<select value={tile.threat} disabled={protectedDen} onChange={event => update({ threat: event.target.value as AuthoredTile['threat'] })}>{['none', 'low', 'high'].map(t => <option key={t}>{t}</option>)}</select></label>
        <label className="tile-editor-check"><input type="checkbox" checked={tile.unlocked} disabled={protectedDen} onChange={event => update({ unlocked: event.target.checked })} />Unlocked</label>
        <label className="tile-editor-check"><input type="checkbox" checked={tile.initiallyRevealed} onChange={event => update({ initiallyRevealed: event.target.checked })} />Revealed at game start</label>
        {(['rough', 'danger', 'impassable'] as const).map(flag => <label key={flag} className="tile-editor-check"><input type="checkbox" checked={tile.flags.includes(flag)} disabled={protectedDen || tile.kind === 'impassable-mountain' && flag === 'impassable'} onChange={event => update({ flags: event.target.checked ? [...tile.flags, flag] : tile.flags.filter(f => f !== flag) })} />{flag}</label>)}
        <label>Arrival tableau<select value={tile.opensTableauOnArrival === undefined ? 'default' : String(tile.opensTableauOnArrival)} disabled={protectedDen} onChange={event => update({ opensTableauOnArrival: event.target.value === 'default' ? undefined : event.target.value === 'true' })}><option value="default">Game default</option><option value="true">Open tableau</option><option value="false">Stay on map</option></select></label>
        {tile.kind === 'path' && <><label>Road print<select value={tile.road?.shape ?? ''} onChange={event => update({ road: event.target.value ? { shape: event.target.value as NonNullable<AuthoredTile['road']>['shape'], rotation: tile.road?.rotation ?? 0 } : undefined })}><option value="">Plain path</option>{['straight', 'crossroads', 'curve', 'fork'].map(shape => <option key={shape}>{shape}</option>)}</select></label>{tile.road && <label>Road rotation<select value={tile.road.rotation} onChange={event => update({ road: { ...tile.road!, rotation: Number(event.target.value) as 0 | 90 | 180 | 270 } })}>{[0, 90, 180, 270].map(n => <option key={n}>{n}</option>)}</select></label>}</>}
        </div><div hidden={component !== 'Lighting'}><label className="tile-editor-check"><input type="checkbox" checked={Boolean(tile.light)} onChange={event => update({ light: event.target.checked ? { color: '#d4ed9b', strength: .65, radius: 3, height: 48, flicker: .15 } : undefined })} />Scenery light</label>
        {tile.light && <><label>Light color<input type="color" value={tile.light.color} onChange={event => update({ light: { ...tile.light, color: event.target.value } })} /></label>
          {(['strength', 'radius', 'height', 'flicker'] as const).map(field => <label key={field}>Light {field}{field === 'height' ? ' (world units)' : ''}<input type="number" min={field === 'radius' ? .1 : 0} max={field === 'height' ? 1000 : field === 'radius' ? 15 : 1} step={field === 'height' ? 1 : .05} value={tile.light![field]} onChange={event => update({ light: { ...tile.light, [field]: Number(event.target.value) } })} /></label>)}</>}
        </div><div className="tile-editor-actions"><button type="submit">Update tile / move</button><button type="button" disabled={protectedDen} onClick={makeCopy}>Duplicate at destination</button></div>
        <button type="button" disabled={protectedDen} onClick={() => commit({ ...document, tiles: document.tiles!.filter(entry => entry.id !== tile.id) }, 'Tile removed from the draft preview.')}>Remove tile</button>
        {protectedDen && <p>Hero’s Den stays at 0,2 for the current home and rest rules.</p>}
      </form>}
    </div><div hidden={section !== 'Terrain defaults'}><form noValidate onSubmit={event => { event.preventDefault(); commit({ ...document, defaults: { ...document.defaults, [defaultKind]: profile } }, 'Shared terrain defaults updated in the draft preview.'); }}>
      <h3>Shared terrain defaults</h3><p>These affect every tile of this terrain that has no override.</p>
      <label>Terrain defaults<select aria-label="Terrain defaults" value={defaultKind} onChange={event => setDefaultKind(event.target.value as TileKind)}>{TILE_KINDS.map(k => <option key={k}>{k}</option>)}</select></label>
      <label>Default STA<input type="number" min="0" max="100" step="0.1" disabled={defaultKind === 'hero-den'} value={profile.traversalDifficulty} onChange={event => setProfile({ ...profile, traversalDifficulty: Number(event.target.value) })} /></label>
      <label>Default travel cards<input type="number" min="1" max="100" value={profile.travelCards} onChange={event => setProfile({ ...profile, travelCards: Number(event.target.value) })} /></label>
      <button type="submit">Update terrain defaults</button>
    </form>
    </div><div className="tile-editor-footer">
      {dirtyForm && <p>Property fields have pending edits. Apply, Save or Export will include them.</p>}
      {dirtyProfile && <p>Shared defaults have pending edits. Apply, Save or Export will include them.</p>}
      {error && <p role="alert">{error}</p>}<p role="status">{status}</p>

    </div>
  </aside>, window.document.body)}</>;
}
