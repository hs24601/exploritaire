Golf content source of truth

The current golf prototype should use `src/golf/data/starterKinData.ts` as its actor-content source of truth.

Legacy / non-golf content to avoid for golf implementation work:
- `src/engine/actors.ts`
- `src/engine/orims.ts`
- `src/data/abilities.json`
- `src/data/abilityProfiles.json`
- `src/data/orims.json`

These files describe older or parallel content schemas and are not the runtime source for golf kin buffs, passives, starter abilities, or golf ORIM progression.

Golf ORIM source of truth:
- `src/golf/data/orims.ts`
