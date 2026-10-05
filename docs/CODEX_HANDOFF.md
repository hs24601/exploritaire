# Codex Handoff

Updated: 2026-04-18

## Current branch

- Branch: `feat/golf-whis-support-prototype`
- Remote: `origin` -> `https://github.com/hs24601/exploritaire.git`

## Latest uncommitted work intended for handoff

- `src/golf/ChargeUpVariant.tsx`
  - Matched player autoplay pacing to enemy pacing.
- `src/golf/MegaHandVariant.tsx`
  - Matched player autoplay pacing to enemy pacing.
- `src/golf/KinHandVariant.tsx`
  - Added player auto-prime support actor moves.
  - Resolved ability damage summaries from effect definitions instead of fire-only bonus text.
  - Applied AP-aware basic-ability power resolution for actor basics.
  - Switched actor damage packet creation to use resolved physical and elemental profiles.
  - Added a "reveal fresh tableau" control that regenerates the tableau layout.
  - Hid golf-value rendering on KinHand support/foundation surfaces where it was noisy.
  - Added a short wait fallback when autoplay animation anchors are temporarily unavailable.

## Verification status

- `npm run typecheck`: fails due to existing repo-wide TypeScript issues outside this handoff slice.
- `npm run build`: fails for the same reason because it depends on `typecheck`.

Most visible blockers are in:

- `src/golf/GolfGame.tsx`
- `src/golf/BenchClassicVariant.tsx`
- `src/golf/ClassicGolfVariant.tsx`
- `src/golf/tutorialRailValidation.ts`
- `src/tooling/ToolingApp.tsx`
- `src/world/ui/NatureManagerUI.ts`
- `src/world/WorldEngine.ts`

## Local-only noise not intended for push

There are modified and untracked files under `artifacts/` from QA/dev-server runs, including log files, screenshots, JSON checks, and PID/log outputs. Review those before staging so only intentional assets go to remote.

## Resume prompt suggestion

Use a prompt like:

`Continue on branch feat/golf-whis-support-prototype from docs/CODEX_HANDOFF.md. Focus on the KinHand/ChargeUp support-actor prototype and keep unrelated repo-wide typecheck failures out of scope unless we decide to fix them.`
