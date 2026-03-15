import { useEffect, useMemo, useState } from 'react';
import { ACTOR_DEFINITIONS } from '../engine/actors';
import type { ActorDefinition } from '../engine/types';
import abilitiesData from '../data/abilities.json';
import enemyEncountersData from '../data/enemyEncounters.json';

type EntityTab = 'kin' | 'enemies' | 'abilities' | 'encounters' | 'combat-logs';
type AbilityDefinition = (typeof abilitiesData.abilities)[number];
type EnemyEncounterBiome = (typeof enemyEncountersData.biomes)[number];
type EnemyEncounter = EnemyEncounterBiome['encounters'][number];
type CombatLogEntry = {
  timestamp: number;
  biomeId: string;
  type: 'move' | 'ability' | 'damage' | 'defeat' | 'autoplay';
  actor: string;
  target?: string;
  detail: Record<string, string | number | boolean | null>;
};

type DraftState = {
  actors: ActorDefinition[];
  abilities: AbilityDefinition[];
  enemyEncounters: EnemyEncounterBiome[];
};

type JsonFieldProps<T> = {
  label: string;
  value: T | undefined;
  onChange: (next: T | undefined) => void;
  rows?: number;
};

const TOOLING_DRAFT_KEY = 'exploritaire-tooling-draft-v1';
const GOLF_COMBAT_LOG_KEY = 'exploritaire.golf.combat-log.v1';
const GOLF_COMBAT_LOG_STATS_KEY = 'exploritaire.golf.combat-log-stats.v1';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const initialDraftState = (): DraftState => ({
  actors: clone(ACTOR_DEFINITIONS),
  abilities: clone(abilitiesData.abilities as AbilityDefinition[]),
  enemyEncounters: clone(enemyEncountersData.biomes as EnemyEncounterBiome[]),
});

const paneButtonClass = (active: boolean) =>
  `rounded-2xl border px-4 py-3 text-xs font-black uppercase tracking-[0.18em] transition-colors ${
    active
      ? 'border-game-gold/55 bg-game-gold/12 text-game-gold shadow-[0_0_20px_rgba(230,179,30,0.14)]'
      : 'border-game-teal/30 bg-black/45 text-game-teal/80 hover:border-game-teal/55'
  }`;

const cardClass = 'rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,16,20,0.9),rgba(3,6,10,0.96))] shadow-[0_18px_60px_rgba(0,0,0,0.35)]';

function JsonField<T>({ label, value, onChange, rows = 7 }: JsonFieldProps<T>) {
  const [raw, setRaw] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [error, setError] = useState('');

  useEffect(() => {
    setRaw(JSON.stringify(value ?? null, null, 2));
    setError('');
  }, [value]);

  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-game-teal/80">{label}</span>
      <textarea
        value={raw}
        rows={rows}
        onChange={(event) => {
          const next = event.target.value;
          setRaw(next);
          try {
            const parsed = JSON.parse(next);
            onChange((parsed === null ? undefined : parsed) as T | undefined);
            setError('');
          } catch {
            setError('Invalid JSON');
          }
        }}
        className="w-full rounded-2xl border border-white/10 bg-black/55 px-3 py-2 font-mono text-xs text-white outline-none transition-colors focus:border-game-gold/45"
      />
      {error ? <span className="text-[10px] font-mono text-game-red">{error}</span> : null}
    </label>
  );
}

function TextField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = '',
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-game-teal/80">{label}</span>
      {multiline ? (
        <textarea
          rows={4}
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-game-gold/45"
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-game-gold/45"
        />
      )}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-game-teal/80">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        className="w-full rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-game-gold/45"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | undefined;
  onChange: (next: string) => void;
  options: string[];
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-game-teal/80">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/55 px-3 py-2 text-sm text-white outline-none transition-colors focus:border-game-gold/45"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option || 'Unset'}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToolingHeader({
  activeTab,
  setActiveTab,
  search,
  setSearch,
  saveLabel,
  onSave,
  onExport,
  onImport,
  dirty,
}: {
  activeTab: EntityTab;
  setActiveTab: (tab: EntityTab) => void;
  search: string;
  setSearch: (value: string) => void;
  saveLabel: string;
  onSave: () => void;
  onExport: () => void;
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void;
  dirty: boolean;
}) {
  return (
    <div className={`${cardClass} sticky top-0 z-20 p-4 md:p-5`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.26em] text-game-gold">Exploritaire Tooling</div>
            <div className="mt-2 max-w-2xl text-sm text-white/70">
              Edit kin, enemies, and abilities in-browser. Works responsively for mobile touch editing and can save back to the repo in dev.
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.18em]">
            <span className={dirty ? 'text-game-gold' : 'text-white/35'}>{dirty ? 'Unsaved Changes' : 'Saved'}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button type="button" className={paneButtonClass(activeTab === 'kin')} onClick={() => setActiveTab('kin')}>Kin</button>
            <button type="button" className={paneButtonClass(activeTab === 'enemies')} onClick={() => setActiveTab('enemies')}>Enemies</button>
            <button type="button" className={paneButtonClass(activeTab === 'abilities')} onClick={() => setActiveTab('abilities')}>Abilities</button>
            <button type="button" className={paneButtonClass(activeTab === 'encounters')} onClick={() => setActiveTab('encounters')}>Encounters</button>
            <button type="button" className={paneButtonClass(activeTab === 'combat-logs')} onClick={() => setActiveTab('combat-logs')}>Combat Logs</button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search entities..."
              className="min-w-[220px] rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-game-gold/45"
            />
            <div className="flex items-center gap-2">
              <label className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-game-teal transition-colors hover:border-game-teal/55">
                Import
                <input type="file" accept="application/json" className="hidden" onChange={onImport} />
              </label>
              <button type="button" onClick={onExport} className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-game-teal transition-colors hover:border-game-teal/55">Export</button>
              <button type="button" onClick={onSave} className="rounded-2xl border border-game-gold/45 bg-game-gold/12 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-game-gold transition-colors hover:bg-game-gold/18">{saveLabel}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActorEditor({
  actor,
  onChange,
}: {
  actor: ActorDefinition;
  onChange: (next: ActorDefinition) => void;
}) {
  return (
    <div className={`${cardClass} p-4 md:p-5`}>
      <div className="mb-4 flex flex-col gap-1">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-game-gold">{actor.name || 'Untitled Actor'}</div>
        <div className="text-sm text-white/55">{actor.id}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TextField label="ID" value={actor.id} onChange={(id) => onChange({ ...actor, id: slugify(id) })} />
        <TextField label="Name" value={actor.name} onChange={(name) => onChange({ ...actor, name })} />
        <TextField label="Sprite" value={actor.sprite ?? ''} onChange={(sprite) => onChange({ ...actor, sprite })} />
        <SelectField label="Type" value={actor.type} onChange={(type) => onChange({ ...actor, type: type as ActorDefinition['type'] })} options={['adventurer', 'npc']} />
        <SelectField label="Element" value={actor.element ?? 'N'} onChange={(element) => onChange({ ...actor, element: element as ActorDefinition['element'] })} options={['N', 'A', 'E', 'F', 'W']} />
        <TextField label="Suit" value={actor.suit ?? ''} onChange={(suit) => onChange({ ...actor, suit: suit || undefined })} />
        <NumberField label="Value" value={actor.value} onChange={(value) => onChange({ ...actor, value: value ?? 1 })} />
        <NumberField label="Base HP" value={actor.baseHp} onChange={(baseHp) => onChange({ ...actor, baseHp })} />
        <NumberField label="Base Armor" value={actor.baseArmor} onChange={(baseArmor) => onChange({ ...actor, baseArmor })} />
        <NumberField label="Base Super Armor" value={actor.baseSuperArmor} onChange={(baseSuperArmor) => onChange({ ...actor, baseSuperArmor })} />
        <NumberField label="Base Stamina" value={actor.baseStamina} onChange={(baseStamina) => onChange({ ...actor, baseStamina })} />
        <NumberField label="Base Energy" value={actor.baseEnergy} onChange={(baseEnergy) => onChange({ ...actor, baseEnergy })} />
        <NumberField label="Base Defense" value={actor.baseDefense} onChange={(baseDefense) => onChange({ ...actor, baseDefense })} />
        <NumberField label="Base Evasion" value={actor.baseEvasion} onChange={(baseEvasion) => onChange({ ...actor, baseEvasion })} />
        <NumberField label="Base Accuracy" value={actor.baseAccuracy} onChange={(baseAccuracy) => onChange({ ...actor, baseAccuracy })} />
        <NumberField label="Base Power" value={actor.basePower} onChange={(basePower) => onChange({ ...actor, basePower })} />
        <TextField label="Art Source" value={actor.artSrc ?? ''} onChange={(artSrc) => onChange({ ...actor, artSrc: artSrc || undefined })} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TextField
          label="Titles"
          value={(actor.titles ?? []).join('\n')}
          multiline
          onChange={(titles) => onChange({ ...actor, titles: titles.split('\n').map((entry) => entry.trim()).filter(Boolean) })}
          placeholder="One title per line"
        />
        <TextField
          label="Description"
          value={actor.description ?? ''}
          multiline
          onChange={(description) => onChange({ ...actor, description })}
        />
        <TextField
          label="Aliases"
          value={(actor.aliases ?? []).join(', ')}
          onChange={(aliases) => onChange({ ...actor, aliases: aliases.split(',').map((entry) => entry.trim()).filter(Boolean) })}
          placeholder="comma, separated, aliases"
        />
        <JsonField label="Orim Slots" value={actor.orimSlots} onChange={(orimSlots) => onChange({ ...actor, orimSlots })} />
        <JsonField label="Orim Enhancements" value={actor.orimEnhancements} onChange={(orimEnhancements) => onChange({ ...actor, orimEnhancements })} />
        <JsonField label="Constellation" value={actor.constellation} onChange={(constellation) => onChange({ ...actor, constellation })} />
      </div>
    </div>
  );
}

function AbilityEditor({
  ability,
  onChange,
}: {
  ability: AbilityDefinition;
  onChange: (next: AbilityDefinition) => void;
}) {
  return (
    <div className={`${cardClass} p-4 md:p-5`}>
      <div className="mb-4 flex flex-col gap-1">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-game-gold">{ability.label || 'Untitled Ability'}</div>
        <div className="text-sm text-white/55">{ability.id}</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TextField label="ID" value={ability.id} onChange={(id) => onChange({ ...ability, id: slugify(id) })} />
        <TextField label="Label" value={ability.label ?? ''} onChange={(label) => onChange({ ...ability, label })} />
        <SelectField label="Ability Type" value={ability.abilityType ?? 'ability'} onChange={(abilityType) => onChange({ ...ability, abilityType })} options={['ability', 'combat', 'exploration', 'passive']} />
        <SelectField label="Element" value={ability.element ?? 'N'} onChange={(element) => onChange({ ...ability, element })} options={['N', 'A', 'E', 'F', 'W']} />
        <SelectField label="Rarity" value={ability.rarity ?? 'common'} onChange={(rarity) => onChange({ ...ability, rarity })} options={['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']} />
        <TextField label="Parent Actor ID" value={ability.parentActorId ?? ''} onChange={(parentActorId) => onChange({ ...ability, parentActorId: parentActorId || undefined })} />
        <NumberField label="Cost" value={ability.cost} onChange={(cost) => onChange({ ...ability, cost: cost ?? 0 })} />
        <NumberField label="Value" value={ability.value} onChange={(value) => onChange({ ...ability, value: value ?? 1 })} />
        <SelectField label="Can Tap" value={ability.canTap ? 'true' : 'false'} onChange={(canTap) => onChange({ ...ability, canTap: canTap === 'true' })} options={['false', 'true']} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TextField label="Description" value={ability.description ?? ''} multiline onChange={(description) => onChange({ ...ability, description })} />
        <JsonField label="Tags" value={ability.tags} onChange={(tags) => onChange({ ...ability, tags })} rows={4} />
        <JsonField label="Effects" value={ability.effects} onChange={(effects) => onChange({ ...ability, effects: effects ?? [] })} rows={9} />
        <JsonField label="Triggers" value={ability.triggers} onChange={(triggers) => onChange({ ...ability, triggers: triggers ?? [] })} rows={9} />
        <JsonField label="Lifecycle" value={ability.lifecycle} onChange={(lifecycle) => onChange({ ...ability, lifecycle })} rows={9} />
        <JsonField label="Tap Effects" value={ability.tapEffects} onChange={(tapEffects) => onChange({ ...ability, tapEffects: tapEffects ?? [] })} rows={9} />
        <JsonField label="Tap Effects By Rarity" value={ability.tapEffectsByRarity} onChange={(tapEffectsByRarity) => onChange({ ...ability, tapEffectsByRarity })} rows={10} />
      </div>
    </div>
  );
}

function EncounterEditor({
  biome,
  encounter,
  onBiomeChange,
  onEncounterChange,
  onCreateEncounter,
  onCloneEncounter,
  onDeleteEncounter,
  onSelectEncounter,
}: {
  biome: EnemyEncounterBiome;
  encounter: EnemyEncounter | null;
  onBiomeChange: (next: EnemyEncounterBiome) => void;
  onEncounterChange: (next: EnemyEncounter) => void;
  onCreateEncounter: () => void;
  onCloneEncounter: () => void;
  onDeleteEncounter: () => void;
  onSelectEncounter: (encounterId: string) => void;
}) {
  return (
    <div className="grid gap-4">
      <div className={`${cardClass} p-4 md:p-5`}>
        <div className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-game-gold">Biome Group</div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TextField label="Biome ID" value={biome.id} onChange={(id) => onBiomeChange({ ...biome, id: slugify(id) })} />
          <TextField label="Label" value={biome.label} onChange={(label) => onBiomeChange({ ...biome, label })} />
          <TextField label="Description" value={biome.description ?? ''} multiline onChange={(description) => onBiomeChange({ ...biome, description })} />
          <JsonField label="Allowed Enemy Actor IDs" value={biome.allowedEnemyActorIds} onChange={(allowedEnemyActorIds) => onBiomeChange({ ...biome, allowedEnemyActorIds: allowedEnemyActorIds ?? [] })} rows={5} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className={`${cardClass} p-4 md:p-5`}>
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-game-teal">Encounter Loadouts</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onCreateEncounter} className="rounded-xl border border-game-teal/35 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-game-teal">New</button>
              <button type="button" onClick={onCloneEncounter} className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">Clone</button>
              <button type="button" onClick={onDeleteEncounter} className="rounded-xl border border-game-red/35 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-game-red">Delete</button>
            </div>
          </div>
          <div className="grid gap-2">
            {biome.encounters.map((entry) => {
              const active = entry.id === encounter?.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onSelectEncounter(entry.id)}
                  className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                    active
                      ? 'border-game-gold/50 bg-game-gold/10'
                      : 'border-white/10 bg-black/35 hover:border-game-teal/35'
                  }`}
                >
                  <div className="text-sm font-black text-white">{entry.label}</div>
                  <div className="mt-1 text-[11px] font-mono text-white/45">{entry.enemyActorIds.join(', ') || 'No actors assigned'}</div>
                </button>
              );
            })}
          </div>
        </div>

        {encounter ? (
          <div className={`${cardClass} p-4 md:p-5`}>
            <div className="mb-4 flex flex-col gap-1">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-game-gold">{encounter.label || 'Untitled Encounter'}</div>
              <div className="text-sm text-white/55">{encounter.id}</div>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <TextField label="Encounter ID" value={encounter.id} onChange={(id) => onEncounterChange({ ...encounter, id: slugify(id) })} />
              <TextField label="Label" value={encounter.label} onChange={(label) => onEncounterChange({ ...encounter, label })} />
              <TextField label="Summary" value={encounter.summary ?? ''} multiline onChange={(summary) => onEncounterChange({ ...encounter, summary })} />
              <JsonField label="Enemy Actor IDs" value={encounter.enemyActorIds} onChange={(enemyActorIds) => onEncounterChange({ ...encounter, enemyActorIds: enemyActorIds ?? [] })} rows={5} />
              <JsonField label="Foundation Seeds" value={encounter.foundationSeeds} onChange={(foundationSeeds) => onEncounterChange({ ...encounter, foundationSeeds: foundationSeeds ?? [] })} rows={8} />
              <JsonField label="Tags" value={encounter.tags} onChange={(tags) => onEncounterChange({ ...encounter, tags: tags ?? [] })} rows={4} />
              <TextField label="Notes" value={encounter.notes ?? ''} multiline onChange={(notes) => onEncounterChange({ ...encounter, notes })} />
            </div>
          </div>
        ) : (
          <div className={`${cardClass} p-6 text-sm text-white/60`}>No encounter selected for this biome.</div>
        )}
      </div>
    </div>
  );
}


function CombatLogViewer() {
  const [entries, setEntries] = useState<CombatLogEntry[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [selectedActor, setSelectedActor] = useState('');

  const loadLogs = () => {
    try {
      const nextEntries = JSON.parse(window.localStorage.getItem(GOLF_COMBAT_LOG_KEY) ?? '[]') as CombatLogEntry[];
      const nextStats = JSON.parse(window.localStorage.getItem(GOLF_COMBAT_LOG_STATS_KEY) ?? '{}') as Record<string, number>;
      setEntries(nextEntries.slice().reverse());
      setStats(nextStats);
    } catch {
      setEntries([]);
      setStats({});
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredEntries = useMemo(() => {
    if (!selectedActor) return entries;
    return entries.filter((entry) => entry.actor === selectedActor || entry.target === selectedActor);
  }, [entries, selectedActor]);

  const actors = useMemo(() => {
    const values = new Set<string>();
    entries.forEach((entry) => {
      values.add(entry.actor);
      if (entry.target) values.add(entry.target);
    });
    return [...values].sort((a, b) => a.localeCompare(b));
  }, [entries]);

  const topEffects = useMemo(() => {
    return Object.entries(stats)
      .filter(([key]) => key.startsWith('effect:'))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [stats]);

  const totalDamage = useMemo(() => {
    return Object.entries(stats)
      .filter(([key]) => key.startsWith('damage:'))
      .reduce((sum, [, value]) => sum + value, 0);
  }, [stats]);

  return (
    <div className="grid gap-4">
      <div className={`${cardClass} p-4 md:p-5`}>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-game-gold">Golf Combat Logs</div>
            <div className="mt-1 text-sm text-white/60">Persistent local autoplay and combat telemetry for balance analysis.</div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedActor}
              onChange={(event) => setSelectedActor(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/55 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-game-gold/45"
            >
              <option value="">All actors</option>
              {actors.map((actor) => (
                <option key={actor} value={actor}>{actor}</option>
              ))}
            </select>
            <button type="button" onClick={loadLogs} className="rounded-2xl border border-game-teal/35 bg-black/45 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-game-teal">Refresh</button>
            <button
              type="button"
              onClick={() => {
                window.localStorage.removeItem(GOLF_COMBAT_LOG_KEY);
                window.localStorage.removeItem(GOLF_COMBAT_LOG_STATS_KEY);
                loadLogs();
              }}
              className="rounded-2xl border border-game-red/35 bg-black/45 px-4 py-3 text-xs font-black uppercase tracking-[0.16em] text-game-red"
            >
              Clear Logs
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-game-teal/75">Stored Events</div>
            <div className="mt-2 text-2xl font-black text-white">{entries.length}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-game-teal/75">Total Damage Logged</div>
            <div className="mt-2 text-2xl font-black text-white">{totalDamage}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-game-teal/75">Move Events</div>
            <div className="mt-2 text-2xl font-black text-white">{stats['type:move'] ?? 0}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.16em] text-game-teal/75">Ability Events</div>
            <div className="mt-2 text-2xl font-black text-white">{stats['type:ability'] ?? 0}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className={`${cardClass} p-4 md:p-5`}>
          <div className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-game-teal">Top Effects</div>
          <div className="grid gap-2">
            {topEffects.length > 0 ? topEffects.map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
                <div className="text-sm font-black text-white">{key.replace('effect:', '')}</div>
                <div className="mt-1 text-[11px] font-mono text-white/45">{value} logged uses</div>
              </div>
            )) : <div className="text-sm text-white/55">No effect usage logged yet.</div>}
          </div>
        </div>
        <div className={`${cardClass} p-4 md:p-5`}>
          <div className="mb-4 flex items-center justify-between">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-game-gold">Recent Events</div>
            <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-white/45">{selectedActor ? `Filtered: ${selectedActor}` : 'Unfiltered'}</div>
          </div>
          <div className="grid gap-2">
            {filteredEntries.slice(0, 80).map((entry, index) => (
              <div key={`${entry.timestamp}-${index}`} className="rounded-2xl border border-white/10 bg-black/35 px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-black text-white">{entry.actor}{entry.target ? ` -> ${entry.target}` : ''}</div>
                  <div className="text-[10px] font-black uppercase tracking-[0.14em] text-game-teal/70">{entry.type}</div>
                </div>
                <div className="mt-1 text-[11px] font-mono text-white/45">{new Date(entry.timestamp).toLocaleString()}</div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-white/5 bg-black/45 p-2 text-[11px] text-white/70">{JSON.stringify(entry.detail, null, 2)}</pre>
              </div>
            ))}
            {filteredEntries.length === 0 ? <div className="text-sm text-white/55">No combat logs captured yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EntityList({
  title,
  items,
  selectedId,
  onSelect,
  onCreate,
  onClone,
  onDelete,
  getLabel,
  getMeta,
}: {
  title: string;
  items: { id: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onClone: () => void;
  onDelete: () => void;
  getLabel: (item: { id: string }) => string;
  getMeta: (item: { id: string }) => string;
}) {
  return (
    <div className={`${cardClass} p-4 md:p-5`}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-game-teal">{title}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCreate} className="rounded-xl border border-game-teal/35 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-game-teal">New</button>
          <button type="button" onClick={onClone} className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/70">Clone</button>
          <button type="button" onClick={onDelete} className="rounded-xl border border-game-red/35 bg-black/45 px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em] text-game-red">Delete</button>
        </div>
      </div>
      <div className="grid gap-2">
        {items.map((item) => {
          const active = item.id === selectedId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`rounded-2xl border px-3 py-3 text-left transition-colors ${
                active
                  ? 'border-game-gold/50 bg-game-gold/10'
                  : 'border-white/10 bg-black/35 hover:border-game-teal/35'
              }`}
            >
              <div className="text-sm font-black text-white">{getLabel(item)}</div>
              <div className="mt-1 text-[11px] font-mono text-white/45">{getMeta(item)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ToolingApp() {
  const [draft, setDraft] = useState<DraftState>(() => {
    const saved = window.localStorage.getItem(TOOLING_DRAFT_KEY);
    if (!saved) return initialDraftState();
    try {
      return JSON.parse(saved) as DraftState;
    } catch {
      return initialDraftState();
    }
  });
  const [activeTab, setActiveTab] = useState<EntityTab>('kin');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedBiomeId, setSelectedBiomeId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    window.localStorage.setItem(TOOLING_DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  const kin = useMemo(() => draft.actors.filter((actor) => actor.type === 'adventurer'), [draft.actors]);
  const enemies = useMemo(() => draft.actors.filter((actor) => actor.type === 'npc'), [draft.actors]);
  const filteredBiomes = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return draft.enemyEncounters;
    return draft.enemyEncounters.filter((biome) => JSON.stringify(biome).toLowerCase().includes(normalized));
  }, [draft.enemyEncounters, search]);

  const activeItems = useMemo(() => {
    if (activeTab === 'combat-logs') return [];
    if (activeTab === 'encounters') return filteredBiomes;
    const normalized = search.trim().toLowerCase();
    const base =
      activeTab === 'kin'
        ? kin
        : activeTab === 'enemies'
          ? enemies
          : draft.abilities;
    if (!normalized) return base;
    return base.filter((item) => JSON.stringify(item).toLowerCase().includes(normalized));
  }, [activeTab, draft.abilities, enemies, filteredBiomes, kin, search]);

  useEffect(() => {
    if (activeItems.length === 0) {
      setSelectedId(null);
      return;
    }
    if (activeTab === 'encounters' || activeTab === 'combat-logs') return;
    if (!selectedId || !activeItems.some((item) => item.id === selectedId)) {
      setSelectedId(activeItems[0].id);
    }
  }, [activeItems, activeTab, selectedId]);

  useEffect(() => {
    if (activeTab !== 'encounters') return;
    if (filteredBiomes.length === 0) {
      setSelectedBiomeId(null);
      setSelectedId(null);
      return;
    }
    const biomeId = selectedBiomeId && filteredBiomes.some((biome) => biome.id === selectedBiomeId)
      ? selectedBiomeId
      : filteredBiomes[0].id;
    setSelectedBiomeId(biomeId);
    const biome = filteredBiomes.find((entry) => entry.id === biomeId) ?? filteredBiomes[0];
    if (!biome.encounters.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !biome.encounters.some((entry) => entry.id === selectedId)) {
      setSelectedId(biome.encounters[0].id);
    }
  }, [activeTab, filteredBiomes, selectedBiomeId, selectedId]);

  const selectedActor = useMemo(
    () => draft.actors.find((actor) => actor.id === selectedId) ?? null,
    [draft.actors, selectedId]
  );
  const selectedAbility = useMemo(
    () => draft.abilities.find((ability) => ability.id === selectedId) ?? null,
    [draft.abilities, selectedId]
  );
  const selectedBiome = useMemo(
    () => draft.enemyEncounters.find((biome) => biome.id === selectedBiomeId) ?? null,
    [draft.enemyEncounters, selectedBiomeId]
  );
  const selectedEncounter = useMemo(
    () => selectedBiome?.encounters.find((encounter) => encounter.id === selectedId) ?? null,
    [selectedBiome, selectedId]
  );

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initialDraftState()), [draft]);

  const saveActors = async () => {
    setSaveState('saving');
    try {
      const response = await fetch('/__actors/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actors: draft.actors }),
      });
      if (!response.ok) throw new Error('Actor save failed');
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const saveAbilities = async () => {
    setSaveState('saving');
    try {
      const response = await fetch('/__abilities/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abilities: draft.abilities }),
      });
      if (!response.ok) throw new Error('Ability save failed');
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const saveEncounters = async () => {
    setSaveState('saving');
    try {
      const response = await fetch('/__enemy-encounters/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ biomes: draft.enemyEncounters }),
      });
      if (!response.ok) throw new Error('Encounter save failed');
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const handleSave = async () => {
    if (activeTab === 'combat-logs') return;
    if (activeTab === 'abilities') {
      await saveAbilities();
      return;
    }
    if (activeTab === 'encounters') {
      await saveEncounters();
      return;
    }
    await saveActors();
  };

  const handleCreate = () => {
    if (activeTab === 'combat-logs') return;
    if (activeTab === 'encounters') {
      const next: EnemyEncounterBiome = {
        id: `biome_${draft.enemyEncounters.length + 1}`,
        label: 'New Biome',
        description: '',
        allowedEnemyActorIds: [],
        encounters: [],
      };
      setDraft((prev) => ({ ...prev, enemyEncounters: [...prev.enemyEncounters, next] }));
      setSelectedBiomeId(next.id);
      setSelectedId(null);
      return;
    }
    if (activeTab === 'abilities') {
      const next: AbilityDefinition = {
        id: `new_ability_${draft.abilities.length + 1}`,
        label: 'New Ability',
        description: '',
        abilityType: 'ability',
        element: 'N',
        rarity: 'common',
        cost: 0,
        value: 1,
        effects: [],
        triggers: [],
        lifecycle: {
          discardPolicy: 'discard',
          exhaustScope: 'none',
          maxUsesPerScope: 1,
          cooldownMode: 'none',
          cooldownValue: 0,
          cooldownStartsOn: 'use',
          cooldownResetsOn: 'turn_start',
        },
        canTap: false,
        tapEffects: [],
        tapEffectsByRarity: {
          common: [],
          uncommon: [],
          rare: [],
          epic: [],
          legendary: [],
          mythic: [],
        },
      };
      setDraft((prev) => ({ ...prev, abilities: [...prev.abilities, next] }));
      setSelectedId(next.id);
      return;
    }

    const type = activeTab === 'kin' ? 'adventurer' : 'npc';
    const next: ActorDefinition = {
      id: `${type}_${draft.actors.length + 1}`,
      name: activeTab === 'kin' ? 'New Kin' : 'New Enemy',
      titles: ['New', activeTab === 'kin' ? 'Kin' : 'Enemy'],
      description: '',
      type,
      value: 1,
      element: 'N',
      sprite: 'âœ¨',
    };
    setDraft((prev) => ({ ...prev, actors: [...prev.actors, next] }));
    setSelectedId(next.id);
  };

  const handleClone = () => {
    if (activeTab === 'combat-logs') return;
    if (activeTab === 'encounters' && selectedBiome) {
      const next = { ...clone(selectedBiome), id: `${selectedBiome.id}_copy`, label: `${selectedBiome.label} Copy` };
      setDraft((prev) => ({ ...prev, enemyEncounters: [...prev.enemyEncounters, next] }));
      setSelectedBiomeId(next.id);
      setSelectedId(next.encounters[0]?.id ?? null);
      return;
    }
    if (!selectedId) return;
    if (activeTab === 'abilities' && selectedAbility) {
      const next = { ...clone(selectedAbility), id: `${selectedAbility.id}_copy`, label: `${selectedAbility.label} Copy` };
      setDraft((prev) => ({ ...prev, abilities: [...prev.abilities, next] }));
      setSelectedId(next.id);
      return;
    }
    if (selectedActor) {
      const next = { ...clone(selectedActor), id: `${selectedActor.id}_copy`, name: `${selectedActor.name} Copy` };
      setDraft((prev) => ({ ...prev, actors: [...prev.actors, next] }));
      setSelectedId(next.id);
    }
  };

  const handleDelete = () => {
    if (activeTab === 'combat-logs') return;
    if (activeTab === 'encounters' && selectedBiomeId) {
      setDraft((prev) => ({ ...prev, enemyEncounters: prev.enemyEncounters.filter((biome) => biome.id !== selectedBiomeId) }));
      return;
    }
    if (!selectedId) return;
    if (activeTab === 'abilities') {
      setDraft((prev) => ({ ...prev, abilities: prev.abilities.filter((ability) => ability.id !== selectedId) }));
      return;
    }
    setDraft((prev) => ({ ...prev, actors: prev.actors.filter((actor) => actor.id !== selectedId) }));
  };

  const handleExport = () => {
    const payload =
      activeTab === 'combat-logs'
        ? {
            entries: JSON.parse(window.localStorage.getItem(GOLF_COMBAT_LOG_KEY) ?? '[]'),
            stats: JSON.parse(window.localStorage.getItem(GOLF_COMBAT_LOG_STATS_KEY) ?? '{}'),
          }
        : activeTab === 'abilities'
        ? { abilities: draft.abilities }
        : activeTab === 'encounters'
          ? { biomes: draft.enemyEncounters }
        : { actors: activeTab === 'kin' ? kin : enemies };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `exploritaire-${activeTab}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (activeTab === 'combat-logs') {
        if (Array.isArray(parsed.entries)) {
          window.localStorage.setItem(GOLF_COMBAT_LOG_KEY, JSON.stringify(parsed.entries));
        }
        if (parsed.stats && typeof parsed.stats === 'object') {
          window.localStorage.setItem(GOLF_COMBAT_LOG_STATS_KEY, JSON.stringify(parsed.stats));
        }
      } else if (activeTab === 'abilities' && Array.isArray(parsed.abilities)) {
        setDraft((prev) => ({ ...prev, abilities: parsed.abilities }));
      } else if (activeTab === 'encounters' && Array.isArray(parsed.biomes)) {
        setDraft((prev) => ({ ...prev, enemyEncounters: parsed.biomes }));
      } else if ((activeTab === 'kin' || activeTab === 'enemies') && Array.isArray(parsed.actors)) {
        const imported = parsed.actors as ActorDefinition[];
        setDraft((prev) => {
          const retained = prev.actors.filter((actor) => actor.type !== (activeTab === 'kin' ? 'adventurer' : 'npc'));
          return { ...prev, actors: [...retained, ...imported] };
        });
      }
    } catch {
      setSaveState('error');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-[#020205] px-3 py-3 text-white md:px-4 md:py-4">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-4">
        <ToolingHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          search={search}
          setSearch={setSearch}
          saveLabel={saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Retry Save' : 'Save'}
          onSave={handleSave}
          onExport={handleExport}
          onImport={handleImport}
          dirty={dirty}
        />


        {activeTab === 'combat-logs' ? (
          <CombatLogViewer />
        ) : (
          <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <EntityList
              title={
                activeTab === 'kin'
                  ? 'Kin Roster'
                  : activeTab === 'enemies'
                    ? 'Enemy Roster'
                    : activeTab === 'abilities'
                      ? 'Ability Catalog'
                      : 'Biome Groups'
              }
              items={activeItems as { id: string }[]}
              selectedId={activeTab === 'encounters' ? selectedBiomeId : selectedId}
              onSelect={activeTab === 'encounters' ? setSelectedBiomeId : setSelectedId}
              onCreate={handleCreate}
              onClone={handleClone}
              onDelete={handleDelete}
              getLabel={(item) =>
                activeTab === 'abilities'
                  ? (item as AbilityDefinition).label
                  : 'encounters' in item
                    ? (item as EnemyEncounterBiome).label
                    : (item as ActorDefinition).name
              }
              getMeta={(item) =>
                activeTab === 'abilities'
                  ? `${(item as AbilityDefinition).abilityType} • ${(item as AbilityDefinition).rarity ?? 'common'}`
                  : 'encounters' in item
                    ? `${(item as EnemyEncounterBiome).encounters.length} encounters`
                    : `${(item as ActorDefinition).type} • value ${(item as ActorDefinition).value}`
              }
            />

            <div className="grid gap-4">
              {activeTab === 'encounters' && selectedBiome ? (
                <EncounterEditor
                  biome={selectedBiome}
                  encounter={selectedEncounter}
                  onBiomeChange={(next) =>
                    setDraft((prev) => ({
                      ...prev,
                      enemyEncounters: prev.enemyEncounters.map((biome) => (biome.id === selectedBiome.id ? next : biome)),
                    }))
                  }
                  onEncounterChange={(next) =>
                    setDraft((prev) => ({
                      ...prev,
                      enemyEncounters: prev.enemyEncounters.map((biome) =>
                        biome.id !== selectedBiome.id
                          ? biome
                          : {
                              ...biome,
                              encounters: biome.encounters.map((encounter) => (encounter.id === next.id || encounter.id === selectedEncounter?.id ? next : encounter)),
                            }
                      ),
                    }))
                  }
                  onCreateEncounter={() => {
                    const next: EnemyEncounter = {
                      id: `encounter_${(selectedBiome.encounters?.length ?? 0) + 1}`,
                      label: 'New Encounter',
                      summary: '',
                      enemyActorIds: [],
                      foundationSeeds: [],
                      tags: [],
                      notes: '',
                    };
                    setDraft((prev) => ({
                      ...prev,
                      enemyEncounters: prev.enemyEncounters.map((biome) =>
                        biome.id === selectedBiome.id
                          ? { ...biome, encounters: [...biome.encounters, next] }
                          : biome
                      ),
                    }));
                    setSelectedId(next.id);
                  }}
                  onCloneEncounter={() => {
                    if (!selectedEncounter) return;
                    const next = { ...clone(selectedEncounter), id: `${selectedEncounter.id}_copy`, label: `${selectedEncounter.label} Copy` };
                    setDraft((prev) => ({
                      ...prev,
                      enemyEncounters: prev.enemyEncounters.map((biome) =>
                        biome.id === selectedBiome.id
                          ? { ...biome, encounters: [...biome.encounters, next] }
                          : biome
                      ),
                    }));
                    setSelectedId(next.id);
                  }}
                  onDeleteEncounter={() => {
                    if (!selectedEncounter) return;
                    setDraft((prev) => ({
                      ...prev,
                      enemyEncounters: prev.enemyEncounters.map((biome) =>
                        biome.id === selectedBiome.id
                          ? { ...biome, encounters: biome.encounters.filter((encounter) => encounter.id !== selectedEncounter.id) }
                          : biome
                      ),
                    }));
                  }}
                  onSelectEncounter={setSelectedId}
                />
              ) : null}

              {activeTab === 'abilities' && selectedAbility ? (
                <AbilityEditor
                  ability={selectedAbility}
                  onChange={(next) =>
                    setDraft((prev) => ({
                      ...prev,
                      abilities: prev.abilities.map((ability) => (ability.id === selectedAbility.id ? next : ability)),
                    }))
                  }
                />
              ) : null}

              {(activeTab === 'kin' || activeTab === 'enemies') && selectedActor ? (
                <ActorEditor
                  actor={selectedActor}
                  onChange={(next) =>
                    setDraft((prev) => ({
                      ...prev,
                      actors: prev.actors.map((actor) => (actor.id === selectedActor.id ? next : actor)),
                    }))
                  }
                />
              ) : null}

              {!selectedActor && (activeTab === 'kin' || activeTab === 'enemies') ? (
                <div className={`${cardClass} p-6 text-sm text-white/60`}>No actor selected.</div>
              ) : null}

              {!selectedAbility && activeTab === 'abilities' ? (
                <div className={`${cardClass} p-6 text-sm text-white/60`}>No ability selected.</div>
              ) : null}

              {!selectedBiome && activeTab === 'encounters' ? (
                <div className={`${cardClass} p-6 text-sm text-white/60`}>No biome selected.</div>
              ) : null}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
