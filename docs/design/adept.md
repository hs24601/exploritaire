# Adept enhancement keru

Creatures are kin; summons/entities are keru. Adept is an enhancement keru applied directly to a kin. Fresh musical combat starts with Common Adept already attached to Hero, at 1 current AP and 12 maximum AP (Dig). It creates no extra kin/team slot. The available offer is hidden while attached; the live Adept control opens Hero's current expression. If a testing state has no Adept, the Momentum gauge reveals its available card beside Mochi, and inspection selects a target kin. This testing draft attaches for free and does not stack. Its chess-like emblem is a code-native presentation placeholder, not newly generated character artwork. Continued encounters preserve existing owner/tier rather than attaching again.

Attachment sets **maximum AP to exactly 12** without granting current AP. Preserve the current bank, clamping an existing bank above 12 to the new ceiling. Casting spends AP and receipts rebuild it up to 12. An enhanced support gains a tableau foundation at value 2 if it was empty, can receive legal cards, and shows that value. Every main-tableau receipt grants exactly one AP up to the new cap, even where older AP multipliers/snatch bonuses would differ. HP, existing abilities and the current prime pile remain with their kin. Enhancement/tier carry through continued encounters and snapshot links.

## Hero expressions

| Current whole AP | Expression | First-pass behavior |
| --- | --- | --- |
| 1 | Dig | Drag Dig onto any second-row card to spend 1 AP and bank that card beside the foundations. Play it once later during a player turn to resolve a rank-free receipt on the current lead foundation. |
| 2–4 | Bite | Base damage equals AP spent. |
| 5–6 | Vice Grip | 1 base damage and the existing diminishing grip duration, with a budget of 3 seconds per AP. |
| 7 | Frenzy I | One stack. |
| 8 | Frenzy II | Two stacks. |
| 9 | Frenzy III | Three stacks. |
| 10 / 11 / 12 | Avatar Howl | Direct-hit stub: 15 / 25 / 40 base damage to one selected enemy. |

Adept sets only the maximum AP ceiling to 12; it does not grant AP. Hero starts at 1 AP. Expressions spend all current AP. AP band/damage is determined before spending. Existing defense/stagger modifiers resolve through the normal damage path; numbers above are base damage. Invalid targets spend nothing. Hero's former free Bite cannot bypass Adept's AP expression. Inspect the Adept badge for targets or drag enhanced Hero's foundation to an enemy for attack/Frenzy expressions. At 0 or above 12 AP no expression is authored; do not silently clamp to Howl. Other kin receive enhancement benefits, with expression sets explicitly pending.

With available cards revealed, the **Test expression AP** field sets the enhanced kin's bank within its actual cap. This is an explicit testing control, not normal AP generation. Rarity is selected before attachment.

## Frenzy golf

The ordinary battle waits while a separate full-screen golf board runs: ten columns, each with four face-up overlapping cards (40 cards total). Only each column's exposed front card is playable. Cards are removed permanently, with no refills or infinifill; cleared columns remain empty. A receipt accepts ±1, with A/K wrapping, onto one current foundation at a time. Each stack initially supplies two stock/foundation cards total, including the first active foundation. The foundation pile shows its current face; the facedown draw pile displays the number of queued stock cards remaining above it, excluding the active foundation. Drawing replaces the foundation with the next queued stock; drawing without another stock ends Frenzy. Every five successful receipts adds one queued stock card and updates the count. Invalid clicks change nothing.

Each successful receipt deals 1 base damage, or **4 base damage instead** when it takes the final card from a column. Every attack rolls a new random living enemy using the minigame's stored seed; defeated enemies are excluded. The normal selected target is preserved. Defense/stagger modifiers still apply through the existing damage resolver. Each receipt also earns the attached kin 1 AP, capped normally, and 1 Momentum. Its foundation/counters remain isolated from the ordinary tableau pile and Bite/Fast Swipes counters. Normal stock/columns are preserved. The mini-deck, targeting RNG, history, clear count, timer and last-hit feedback are serializable. Clearing all ten columns, victory, timeout, stock exhaustion or Finish Frenzy ends the board without refunding spent AP. Player pause freezes the clock; restored paused sessions expose Resume Frenzy. Earlier one-card-column snapshot representations are read safely but remain historical deals.

Generous first-pass Common clock: 90 + 30 seconds per stack (120/150/180 seconds). Rarity drafts keep the exact 12-AP cap, all AP bands, damage, stock and five-receipt bonuses unchanged:

| Draft | Extra Frenzy time |
| --- | --- |
| Common | 0 seconds |
| Rare | +30 seconds |
| Epic | +60 seconds |
| Legendary | +90 seconds |

These values and free attachment are explicit temporary scaffolding for evaluating the mechanic. No learned ability is required to gain Hero's listed expressions. Kin-specific expressions beyond Hero, enhancement removal/reassignment, Avatar Howl presentation and tighter balance remain unauthored.

Validation: `adept.test.ts` covers all 12 bands, capacity/current AP, support receipts, Dig, base damage and AP spending, grip, stock/bonus/refill/timeout rules, all rarity clocks, snapshots and continued encounters. `tools/adept-check.cjs` verifies availability, attachment, live AP tuning, Bite, Frenzy timer/receipt damage, phone presentation and Howl victory using the browser UI.




