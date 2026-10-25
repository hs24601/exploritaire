import briSubject from '../../artifacts/keru-creatures-v2/bri-subject-v2.png';
import demSubject from '../../artifacts/dem-style-v3/dem-storybook-v3.png';
import demBackground from '../../artifacts/dem-draft/dem-background-v1.png';
import { CIR_ART } from './rules/battle';
import briBackground from '../../artifacts/keru-drafts/bri-background-v1.png';
import solSubject from '../../artifacts/keru-creatures-v2/sol-subject-v2.png';
import solBackground from '../../artifacts/keru-drafts/sol-background-v1.png';
import veySubject from '../../artifacts/keru-creatures-v2/vey-subject-v2.png';
import veyBackground from '../../artifacts/keru-drafts/vey-background-v1.png';
import fluxSubject from '../../artifacts/keru-creatures-v2/flux-subject-v2.png';
import fluxBackground from '../../artifacts/keru-drafts/flux-background-v1.png';
import axiSubject from '../../artifacts/keru-creatures-v2/axi-subject-v2.png';
import axiBackground from '../../artifacts/keru-drafts/axi-background-v1.png';
export type KeruDraftTarget = 'hero' | 'mochi' | 'enemy' | 'self' | 'all-enemies';
export type KeruDraftExpression = { name: string; cost: number; text: string; rules: string };
export type KeruDraft = {
  id: string; name: string; element: string; role: string; inspiration: string; identity: string; backgroundLabel: string; tint: string;
  bindings: Record<'hero' | 'mochi', KeruDraftExpression>;
  invocation: KeruDraftExpression & { targets: KeruDraftTarget[] };
  synergies: string[]; tradeoff: string; checks: string[];
};
/** Authored design proposals only. These entries are never consumed by battle resolution. */
export const KERU_DRAFTS: readonly KeruDraft[] = [
  {
    "id": "bri",
    "name": "Bri",
    "element": "Nature",
    "role": "Regeneration · patient growth",
    "inspiration": "Druid regeneration and delayed bloom procs.",
    "identity": "An ancient woodland stag with branching fern-and-wood antlers, moss at the shoulders and new growth along old bark scars. Bri feels patient and imposing, with living renewal rooted in an adult animal silhouette.",
    "backgroundLabel": "a mossy woodland spring",
    "tint": "#aecf80",
    "bindings": {
      "hero": {
        "name": "Rootmend",
        "cost": 3,
        "text": "Every third valid Hero builder receipt restores 1 HP to Hero.",
        "rules": "Count actual valid Hero builder receipts while bound; every third restores 1 HP, capped at max HP. No overheal, revival or wall-clock healing. Recall clears the unfinished counter."
      },
      "mochi": {
        "name": "Bloom Claws",
        "cost": 4,
        "text": "Every third damaging Mochi attack adds 2 nature damage and restores 1 HP to Mochi.",
        "rules": "Count attacks whose ordinary damage resolves positive HP loss, once per attack even for multi-hit or added-element packets. On the third, add one mitigated 2-nature packet and heal Mochi 1 HP if she is living. Reset the counter after the proc; recall clears unfinished progress. The extra packet earns no AP, Momentum or new triggers."
      }
    },
    "invocation": {
      "name": "Verdant Shelter",
      "cost": 6,
      "text": "Restore 6 HP to one living Kin. Reduce their next incoming attack by 2. Exhaust Bri for this battle.",
      "targets": [
        "hero",
        "mochi"
      ],
      "rules": "Choose one living injured Kin or a living Kin without this pending shelter. Heal up to 6 missing HP. A single 2-point attack-reduction token persists until their next direct incoming attack or battle end. Apply it to total attack damage after mitigation, floor zero, then consume it; no stacking, revival, effect on retaliation, or turn denial."
    },
    "synergies": [
      "Cir on Mochi + Bri on Hero: Rootmend sustains Hero while Ember Claws supplies reliable fire damage. Bri does not replace finite mana or out-of-combat rest.",
      "Bri’s sustain can complement Dem’s Ice Wall while the party capitalizes on Aurora Bearealis.",
      "Verdant Shelter can protect the Kin drawing enemy attention; it does not change highest-AP targeting."
    ],
    "tradeoff": "Slow sustain loses value in short fights. Rootmend requires three paid-for-in-actions receipts per HP; Bloom Claws is delayed and can lose unfinished growth on recall.",
    "checks": [
      "Verify multi-hit attacks advance Bloom Claws only once.",
      "Verify full-HP, downed and battle-end states; healing cannot revive.",
      "Check pending Shelter consumption on zero-damage attacks and multi-hit packets."
    ]
  },
  {
    "id": "sol",
    "name": "Sol",
    "element": "Light",
    "role": "Wards · cleansing",
    "inspiration": "Cleric cleansing and paladin prevention.",
    "identity": "A vigilant radiant crane with long legs, an ivory spear beak and luminous gold flight feathers. Sol has the composure of a watchful sentinel rather than a cheerful lantern mascot.",
    "backgroundLabel": "a sunlit watercolor glade",
    "tint": "#f3d598",
    "bindings": {
      "hero": {
        "name": "Dawnguard",
        "cost": 3,
        "text": "At each player team turn start, Hero gains 1 Ward, up to 2.",
        "rules": "No Ward on binding. At each real player-team-turn start, add 1 Ward to Hero, total cap 2 from all proposed sources. Ward is an HP-damage absorption pool after mitigation, used before HP, and never absorbs stagger. Consumed points are not HP loss. Rebinding cannot duplicate a turn-start event. Recall removes Ward granted by Sol."
      },
      "mochi": {
        "name": "Clearstep",
        "cost": 4,
        "text": "Mochi’s first damaging attack each turn cleanses one debuff from her; if none, gain 1 Ward (max 2).",
        "rules": "On Mochi's first attack with positive ordinary HP damage each player team turn, remove her oldest explicitly dispellable harmful status. If none exists, grant 1 Ward, capped at 2. Do not clear downed, Disarmed, authored armor/phases, pending damage already resolved, or stagger meters. Recall does not refresh the per-turn allowance and removes remaining Sol-granted Ward."
      }
    },
    "invocation": {
      "name": "First Dawn",
      "cost": 6,
      "text": "Restore 3 HP and cleanse one debuff from each living Kin. Exhaust Sol for this battle.",
      "targets": [
        "hero",
        "mochi"
      ],
      "rules": "The selected living ally anchors a team invocation, not multiple casts. All living party Kin heal up to 3 missing HP and lose their oldest explicitly dispellable harmful status. No revival or removal of Disarmed, stagger, encounter flags or authored phase defenses. Disable if no living Kin has missing HP or a dispellable debuff."
    },
    "synergies": [
      "Cir on Hero + Sol on Mochi: Hearthflame's retaliation still responds to attacks against Hero, while Clearstep helps Mochi keep attacking through dispellable hindrances.",
      "Sol on Hero + Bri on Mochi: Dawnguard prevents damage and Bloom Claws repairs small losses; they cannot overheal or accumulate unlimited Ward.",
      "First Dawn offers a recovery choice at the same reserve threshold as Meteor: stabilize the team or spend on a finisher."
    ],
    "tradeoff": "Ward builds only at real turn starts and caps at 2. Cleansing is situational, so Clearstep has a small capped fallback. No new harmful status is silently added to existing encounters.",
    "checks": [
      "Verify Ward consumption per attack, including multi-hit and zero damage.",
      "Ensure cleanse honors explicit dispellable tags and excludes Disarmed/phases.",
      "Check recall attribution when other future Ward sources exist."
    ]
  },
  {
    "id": "vey",
    "name": "Vey",
    "element": "Dark",
    "role": "Life drain · weakening curses",
    "inspiration": "Warlock curses and restrained lifesteal.",
    "identity": "A lean predatory panther whose hindquarters trail into indigo shadow. Vey's low stalking posture, long muzzle and pale narrow eyes communicate real danger; shadow and life-drain motifs remain part of its body.",
    "backgroundLabel": "a violet starlit forest hollow",
    "tint": "#ba9bd6",
    "bindings": {
      "hero": {
        "name": "Dusk Thread",
        "cost": 3,
        "text": "When an enemy attack costs Hero HP, weaken that foe’s next attack by 1. Does not stack.",
        "rules": "After actual HP loss from a direct enemy attack, put one nonstacking Weaken token on the attacker, if it accepts the debuff. Its next direct attack against any Kin loses 1 total damage after mitigation, floor zero, then consumes the token. Multi-hit is one attack. Retaliation, poison and self-damage cannot apply it. Recall removes outstanding Vey curses."
      },
      "mochi": {
        "name": "Sable Sip",
        "cost": 4,
        "text": "Mochi’s first damaging attack each turn restores up to 2 HP to her, limited by HP damage dealt.",
        "rules": "After Mochi's first ordinary attack with positive actual HP loss each player team turn, heal her by min(2, target's actual HP lost to that attack, Mochi's missing HP). Overkill does not count. Ignore retaliation and added Keru packets for the drain basis. No extra damage, overheal, revival or Momentum; recall does not refresh the allowance."
      }
    },
    "invocation": {
      "name": "Nightwell",
      "cost": 6,
      "text": "Deal 5 dark damage. Restore up to 3 HP to the most injured living Kin, limited by HP damage dealt. Exhaust Vey.",
      "targets": [
        "enemy"
      ],
      "rules": "Resolve one 5-dark packet through applicable mitigation/vulnerability. Heal min(3, actual HP lost to the packet) to the living ally with the greatest absolute missing HP; ties use party order. Cap at max HP. If no ally is injured, damage still resolves. Cannot revive; damage immunity yields no healing. Exhaustion lasts for this battle."
    },
    "synergies": [
      "Vey on Hero + Cir on Mochi: Dusk Thread softens repeat attackers while Ember Claws maintains pressure. A fully blocked attack does not create the curse.",
      "Sol on Hero + Vey on Mochi: capped Ward buys time while Sable Sip repairs Mochi's own losses; overkill cannot inflate healing.",
      "Aurora’s Exposed can support Nightwell’s attacks; its healing remains capped by actual HP damage."
    ],
    "tradeoff": "Reactive weakening requires taking HP damage first. Lifesteal needs a vulnerable living foe and benefits only an injured living recipient; armor and full HP limit its value.",
    "checks": [
      "Verify overkill clamps and lifesteal based on actual HP lost.",
      "Ensure retaliation cannot loop curse or drain.",
      "Check Weaken immunity, multi-hit consumption and pending-token cleanup."
    ]
  },
  {
    "id": "flux",
    "name": "Flux",
    "element": "Chaos",
    "role": "Visible fortune · tactical adaptation",
    "inspiration": "Wild-magic outcomes and gambler resource swings, with a readable next outcome.",
    "identity": "A rangy storm-hyena with a high bristling mane, mismatched ember and violet markings, and a jagged tail. Flux is unruly and dangerous, with weather-like instability rather than a cheerful ribbon body.",
    "backgroundLabel": "a woodland crossing of sunset and storm",
    "tint": "#e6a7c9",
    "bindings": {
      "hero": {
        "name": "Lucky Current",
        "cost": 3,
        "text": "Hero’s first builder receipt each turn gains +0 or +2 Momentum. The next bonus is visible.",
        "rules": "One trial per actual player team turn, triggered by Hero's first valid builder receipt while bound; add the visible bonus to the normal receipt. Equal-probability 0/2 results come from a per-battle seeded stream. Draw the next result only on consumption. Inspection, recall, rebinding, disabled casts and time do not reroll or refresh the per-turn allowance. No multiplying the bonus by other earnings modifiers."
      },
      "mochi": {
        "name": "Wild Paws",
        "cost": 4,
        "text": "Mochi’s first damaging attack each turn adds 2 chaos damage or 2 stagger. The next result is visible.",
        "rules": "On the first attack with positive ordinary HP loss each player team turn, consume the visible equal-probability outcome. Either add one mitigated 2-chaos packet, or add 2 stagger subject to immunity. One roll per attack, no trigger chains or Momentum. A blocked stagger result stays blocked; it does not convert to damage. The seeded outcome and turn allowance survive recall/rebinding."
      }
    },
    "invocation": {
      "name": "Wild Surge",
      "cost": 6,
      "text": "Deal 4 chaos damage and 2 stagger, or 8 chaos damage. Preview the result before casting. Exhaust Flux.",
      "targets": [
        "enemy"
      ],
      "rules": "A separate per-battle seeded 50/50 result is visible from battle start. Casting consumes it: either one 4-chaos packet plus 2 stagger, or one 8-chaos packet. Normal defenses and control immunity apply. Inspection, cancellation, changing targets and rebinding cannot reroll. Exhaust Flux for this battle even if the result is mitigated."
    },
    "synergies": [
      "Cir on Mochi + Flux on Hero: visible Lucky Current bonuses tell the player when an earned Momentum burst can help fund the next paid ability.",
      "Dem’s wall buys the party time to plan around Flux’s visible damage/stagger outcomes.",
      "Wild Surge's stagger branch can set up Cir's later Meteor; the 8-damage branch may finish immediately. Neither branch promises a universal advantage."
    ],
    "tradeoff": "A visible weak result is still weak. Forecasting makes variance a planning constraint, but removes neither armor nor stagger immunity. No random rank changes, card deletions or forced redeals.",
    "checks": [
      "Prove all previews/cancel/recall paths preserve seeded outcomes.",
      "Consume the first-per-turn allowance once across multi-hit and rebinding.",
      "Verify previewed packets and resolved mitigation match; no outcome substitution."
    ]
  },
  {
    "id": "axi",
    "name": "Axi",
    "element": "Order",
    "role": "Cadence · measured control",
    "inspiration": "Monk combo cadence and tactician precision.",
    "identity": "A massive adult tortoise with a balanced limestone shell and jade seams. Axi's heavy stance and severe watchful face suggest patient, unstoppable defense; orderly motifs follow real shell anatomy.",
    "backgroundLabel": "a balanced jade woodland pool",
    "tint": "#a9cdbd",
    "bindings": {
      "hero": {
        "name": "Measured Flow",
        "cost": 3,
        "text": "Three consecutive Hero builder plays alternating up/down grant +1 Momentum. Then begin a new set.",
        "rules": "Count only valid Hero receipts while bound. Each receipt must be opposite in rank direction to the preceding one in the set; the first starts at 1. A same-direction Hero play restarts at 1. Another Kin's builder receipt breaks the set. On reaching 3, add exactly +1 shared Momentum and clear the set. K→A is up and A→K is down under normal wrap rules. Team handoff preserves progress; recall clears it. No timing requirement or altered golf legality."
      },
      "mochi": {
        "name": "Patient Claws",
        "cost": 4,
        "text": "Every second damaging Mochi attack against the same foe adds 2 stagger. Switching foes starts a new count.",
        "rules": "Count once per ordinary attack that causes positive HP loss. The second consecutive qualifying Mochi attack against the same foe adds 2 stagger, respecting immunity, then clears the pair. A Mochi attack against another foe starts a new pair; a zero-HP-damage attack breaks it. Other actors' attacks do not affect the count. Recall clears progress, and added packets/retaliation cannot advance it."
      }
    },
    "invocation": {
      "name": "Verdict",
      "cost": 6,
      "text": "Deal 5 order damage, or 8 if the target is already staggered. Exhaust Axi for this battle.",
      "targets": [
        "enemy"
      ],
      "rules": "Read the target's staggered state immediately before resolution, choose a base packet of 5 or 8, then apply normal element mitigation and ordinary stagger vulnerability once. This is one packet, not 5+3 hits. Do not add stagger, bypass phase armor or force a response skip. Exhaust Axi for this battle."
    },
    "synergies": [
      "Axi on Mochi + Cir on Hero: Patient Claws supplies measured stagger pressure while Hearthflame earns Momentum; either invocation can spend the prepared opening.",
      "Dem builds protection while Axi rewards deliberate sequencing and measured stagger pressure.",
      "Sol's Ward can buy the team a safer turn to finish Measured Flow, but cannot make illegal card directions valid."
    ],
    "tradeoff": "Measured Flow asks the player to give up some long same-direction lines. Patient Claws commits Mochi to a foe. Verdict needs prior setup to equal Cir's base Meteor damage.",
    "checks": [
      "Check A/K direction, actor interruptions, same-direction resets and three-play receipts.",
      "Check target switching, zero damage, defeat and multi-hit pair counters.",
      "Verify Verdict snapshots stagger before the packet and applies normal vulnerability once."
    ]
  },
  {
    "id": "dem",
    "name": "Dem",
    "element": "Ice",
    "role": "Tanking · protection · illumination",
    "inspiration": "Demeter-inspired name; a protective ice bear. Dem uses they/them pronouns.",
    "identity": "Dem is a storybook ice polar bear with expressive blue eyes, oversized paws and an angular frozen mantle. They build protection for their companions and illuminate hidden threats. Their approved chunky gouache/watercolor treatment shares Hero’s storybook style.",
    "backgroundLabel": "a frozen woodland pool",
    "tint": "#a7d8ee",
    "bindings": {
      "hero": {
        "name": "Stillwater",
        "cost": 3,
        "text": "Halve passive Momentum decay while bound.",
        "rules": "Apply one 0.5 multiplier to passive shared Momentum decay while Dem is bound to Hero. Current 0.5/s becomes 0.25/s; disabled or frozen decay stays zero. No generation, discount or compound multiplier."
      },
      "mochi": {
        "name": "Rime Paws",
        "cost": 4,
        "text": "Mochi’s first damaging attack each team turn adds 1 stagger.",
        "rules": "Trigger once per player team turn after positive ordinary HP damage, once per attack even for multi-hit. Added packets and retaliation cannot trigger it; respect stagger immunity. Recall does not refresh the allowance."
      }
    },
    "invocation": {
      "name": "Winter Hush",
      "cost": 6,
      "text": "Deal 4 ice damage. Freeze the next enemy response, subject to control immunity. Exhaust Dem for this battle.",
      "targets": [
        "enemy"
      ],
      "rules": "One mitigated 4-ice packet, then one pending response skip on a surviving eligible enemy. The skip overlaps an existing pending stagger/control skip instead of queueing. Immunity prevents the skip, not applicable damage. Exhaust Dem for this battle."
    },
    "synergies": [
      "Ice Wall converts Dem’s legal foundation plays into protection while companions supply damage.",
      "Polar Presence draws eligible single-target attacks into the wall rather than leaving the party unprotected.",
      "Aurora Bearealis reveals future sequencing options and lets allied attacks exploit Exposed; Glacial Reprisal trades stored defense for a burst."
    ],
    "tradeoff": "Dem forgoes automatic receipt attacks to build defense. Spending barrier on Reprisal leaves them more vulnerable. Aurora’s information and crit support help their companions capitalize on that defensive investment.",
    "checks": [
      "Implement Dem’s actor and own foundation before treating these proposals as playable.",
      "Specify barrier absorption, duplicate-card protection, taunt eligibility, reveal coverage and seeded attack-level critical hits."
    ]
  },
  {
    "id": "cir",
    "name": "Cir",
    "element": "Fire",
    "role": "Meteor phoenix · active fire baseline",
    "inspiration": "Phoenix imagery and meteor burst damage; rebirth is a visual motif, not a revive mechanic.",
    "identity": "A fierce meteor phoenix with a white-hot breast, molten-gold wings and a long streaming ember train. The silhouette keeps Cir's shooting-star direction and luminous meteor core while becoming a recognizable supernatural bird.",
    "backgroundLabel": "the existing painted starry woodland",
    "tint": "#efb070",
    "bindings": {
      "hero": {
        "name": "Hearthflame",
        "cost": 3,
        "text": "Attackers take 1 fire damage while attacking Hero. Hero gains 1.25× Momentum.",
        "rules": "Current game baseline: every attack against Hero triggers 1 fire counter, including zero-damage attacks. Hero's valid builder receipts earn 1.25× base Momentum. Applicable fire defenses and retaliation-loop guards remain in force."
      },
      "mochi": {
        "name": "Ember Claws",
        "cost": 4,
        "text": "Mochi’s attacks deal +1 fire damage.",
        "rules": "Current game baseline: add the existing fire component to Mochi's damaging attacks. It generates no extra stagger or Momentum and preserves ordinary and authored encounter defenses."
      }
    },
    "invocation": {
      "name": "Meteor",
      "cost": 6,
      "text": "Deal 8 fire damage. Exhaust Cir for this battle.",
      "targets": [
        "enemy"
      ],
      "rules": "Current game baseline: resolve the existing 8-fire Meteor and battle exhaustion. Preserve target validation, paid casts, armor, stagger vulnerability and Scenario 006's required sequence. The phoenix artwork changes presentation only."
    },
    "synergies": [
      "Dem’s Aurora can support Cir’s Meteor, while the ice wall protects the party’s setup turns.",
      "Cir on Mochi + Bri on Hero pairs fire pressure with receipt-driven healing.",
      "A prepared stagger opening can strengthen Meteor through existing vulnerability; the phoenix does not grant automatic resurrection."
    ],
    "tradeoff": "The current paid-bind, recall and exhaust choices stay intact. Meteor gives up Cir's remaining familiar utility for that battle.",
    "checks": [
      "Check phoenix visibility on live ability, drag, buff and recall surfaces.",
      "Verify Cir mechanics and Scenario 006 remain unchanged."
    ]
  }
];
export const KERU_DRAFT_ART: Record<string, { subject: string; background: string }> = {
  dem: { subject: demSubject, background: demBackground },
  cir: { subject: CIR_ART, background: `${import.meta.env.BASE_URL}assets/runtime/ui/holocards/layered/hero-night-background-v2-ordinary-day.png` },
  bri: { subject: briSubject, background: briBackground },
  sol: { subject: solSubject, background: solBackground },
  vey: { subject: veySubject, background: veyBackground },
  flux: { subject: fluxSubject, background: fluxBackground },
  axi: { subject: axiSubject, background: axiBackground },
};

export type KeruAbilityDefinition = KeruDraftExpression & {
  id: string; keruId: string; usage: 'persistent' | 'single-use' | 'stance' | 'temporary' | 'instant'; targets: readonly KeruDraftTarget[];
};
/** Dem tank proposals: user concepts plus two explicitly labeled recommendations. */
const DEM_TANK_ABILITIES: readonly KeruAbilityDefinition[] = [
  {
    "id": "dem-ice-wall",
    "keruId": "dem",
    "name": "Ice Wall",
    "cost": 3,
    "usage": "stance",
    "targets": [
      "self"
    ],
    "text": "While active, Dem’s foundation cards build +1 barrier HP each instead of triggering their attacks.",
    "rules": "User concept; proposed resolution: Dem keeps ordinary Momentum earnings. Count actual new cards legally received by their foundation, not a raw Momentum gain, redraw or repeated transfer of the same card. Start at 0 barrier, proposed cap 10. Absorb incoming attack HP damage before Dem’s HP; stagger remains separate. No attack means no attack/on-hit proc. The stance persists at 0 barrier. Requires Dem’s own combat foundation, which is not implemented."
  },
  {
    "id": "dem-aurora-bearealis",
    "keruId": "dem",
    "name": "Aurora Bearealis",
    "cost": 5,
    "usage": "temporary",
    "targets": [
      "all-enemies"
    ],
    "text": "Light/Ice · Reveal all tableau cards and backfills for 2 turns. Affected enemies gain Exposed: +25 percentage points to attack crit chance.",
    "rules": "User concept with draft tuning: encounter-wide illumination reveals information, never removes coverage or makes buried cards playable. Reveal backfills while active. Proposed duration: through the second enemy response opportunity after cast; skipped responses still count, pause does not. Apply Exposed to enemies under the aurora, including later arrivals during its duration. Proposed crit: one seeded roll per attack/target, +25 percentage points capped at 100%, 1.5× HP damage on success; no bonus stagger. No rolls for retaliation, damage over time or costs. Refresh duration without stacking Exposed."
  },
  {
    "id": "dem-polar-presence",
    "keruId": "dem",
    "name": "Polar Presence",
    "cost": 2,
    "usage": "temporary",
    "targets": [
      "self"
    ],
    "text": "Proposal · Taunt enemies for 2 turns: their eligible single-target attacks prioritize Dem.",
    "rules": "Recommended addition, not an approved mechanic. Dem must be a living eligible target; taunt does not override authored targeting locks or control immunity. Area attacks remain area attacks. Proposed duration uses the same response-opportunity clock as Aurora. No damage immunity or free barrier. Ice Wall then has a reason to absorb enemy pressure for the party."
  },
  {
    "id": "dem-glacial-reprisal",
    "keruId": "dem",
    "name": "Glacial Reprisal",
    "cost": 4,
    "usage": "instant",
    "targets": [
      "enemy"
    ],
    "text": "Proposal · Spend up to 6 barrier HP to deal that much ice damage and add 2 stagger.",
    "rules": "Recommended addition, not an approved mechanic. Select a living foe and commit 1–6 current barrier HP plus the proposed Momentum cost; disable with no barrier. Resolve one ice attack through normal defenses and Aurora’s crit rule; add 2 stagger subject to immunity. Spend barrier even when armor reduces damage. This is a manual ability, so Ice Wall’s suppression of automatic receipt attacks does not prevent it. Does not automatically end the stance or exhaust Dem; single-use here means a one-shot cast, and the general catalog’s old exhaustion terminology must not be inferred."
  }
];
/** Stable abilities; target validation selects recipients, never ability identity.
 * The older draft grouping above remains a migration source, not a selection rule. */
export const KERU_ABILITIES: readonly KeruAbilityDefinition[] = KERU_DRAFTS.flatMap(keru => {
  if (keru.id === 'dem') return DEM_TANK_ABILITIES;
  const define = (effect: KeruDraftExpression, usage: KeruAbilityDefinition['usage'], targets: readonly KeruDraftTarget[]): KeruAbilityDefinition => ({
    ...effect, id: keru.id + '-' + effect.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), keruId: keru.id, usage, targets,
  });
  return [define(keru.bindings.hero, 'persistent', ['hero']), define(keru.bindings.mochi, 'persistent', ['mochi']), define(keru.invocation, 'single-use', keru.invocation.targets)];
});
