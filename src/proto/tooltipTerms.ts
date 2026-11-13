import { STATUS_META, type StatusId } from './rules/battleStatusData';
import { MOMENTUM_SKILLS, createCombatSandboxScenario, type MomentumSkillId } from './rules/battle';
import { statusDetail } from './components/BattleStatusIcons';

/** Stable IDs survive renames. Optional namespaces disambiguate skill/status IDs. */
export function resolveTooltipTerm(key: string): { name: string; description: string } | null {
  const [namespace, id] = key.includes(':') ? key.split(':') : ['', key];
  if (namespace !== 'ability' && Object.prototype.hasOwnProperty.call(STATUS_META, id)) {
    const meta = STATUS_META[id as StatusId];
    const battle = createCombatSandboxScenario('1000');
    return { name: meta.name, description: meta.description || statusDetail({ id: id as StatusId }, battle.foes[0], battle) };
  }
  if (namespace !== 'status' && Object.prototype.hasOwnProperty.call(MOMENTUM_SKILLS, id)) {
    const skill = MOMENTUM_SKILLS[id as MomentumSkillId];
    return { name: skill.name, description: skill.description };
  }
  return null;
}

export function tooltipParts(text: string): { id?: string; label: string }[] {
  const result: { id?: string; label: string }[] = [];
  const pattern = /\[\[([a-z][a-z0-9:-]*)(?:\|([^\]]+))?\]\]/g;
  let start = 0;
  for (const match of text.matchAll(pattern)) {
    result.push({ label: text.slice(start, match.index) });
    result.push({ id: match[1], label: match[2] ?? resolveTooltipTerm(match[1])?.name ?? match[1] });
    start = match.index! + match[0].length;
  }
  result.push({ label: text.slice(start) });
  return result;
}

export function tooltipHeading(anchor: Element): string | undefined {
  const explicit = anchor.getAttribute('data-tooltip-title');
  if (explicit) return explicit;
  const id = anchor.getAttribute('data-status') ?? anchor.getAttribute('data-skill');
  return id ? resolveTooltipTerm(id)?.name : undefined;
}
