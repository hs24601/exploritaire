# Pack Leader

Hero's musical-combat passive starts ready at Common rarity: one free party-leader promotion, replenished after three player-turn openings. Enemy half-turns do not tick it. Hero owns the passive even while supporting and must be alive and able to use abilities.

Drag the prime value ornament onto an eligible living support, use its keyboard transfer, or inspect Pack Leader and choose a free promotion target. A ready charge is used before Momentum, costs no AP or Momentum, and is consumed only by a successful transfer. During recharge, ordinary promotions still cost 3 Momentum and leave the timer unchanged. Existing target eligibility rules apply.

The circular buff shows readiness or remaining turns and opens the ability card. The card joins Hero's side gallery and reuses her current watercolor artwork. This implementation does not introduce newly generated artwork.

| Draft | Recharge in player turns | Charge capacity |
| --- | --- | --- |
| Common (default) | 3 | 1 |
| Rare | 2 | 1 |
| Epic | 1 | 1 |
| Legendary | 1 | 2 |

Gear exposes gameplay rarity and a custom integer recharge interval n from 1–12. Changing tuning never grants charges. Lowering capacity clamps stored charges; lowering n clamps the remaining cooldown. Raising n preserves the current remaining cooldown and applies to subsequent recharge cycles. A custom n remains in effect when changing rarity. Legendary replenishes one charge per interval until full; spending another charge while recharging preserves the running timer.

Continued encounters preserve the owner, tuning, stored charges and cooldown, and count their opening as one new player turn. Older musical parties without the passive receive the ready Common default on continuation. Fresh encounters outside musical combat retain their existing rules.
