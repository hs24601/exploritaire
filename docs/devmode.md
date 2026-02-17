# Dev Mode Flag (`#devmode`)

`#devmode` is the project gate for backlog and experimental gameplay features that can break normal play.

## Why
- Prevent game-breaking or unbalanced test mechanics from leaking into standard play.
- Keep one codepath for playtesting without needing separate builds.

## How To Enable
- Add `#devmode` to the URL hash while the app is running.
- Example: `http://localhost:5173/#devmode`
- The flag updates live on hash changes (no hard reload required).

## Policy
- Backlog/experimental gameplay behaviors must be gated by `#devmode`.
- Production-safe/default behavior must remain active when `#devmode` is not present.
- If a feature is promoted out of backlog, remove the gate and update this doc.

## Current Gated Features
- Exploration AP lock toggle from the AP readout.
- Exploration dev traverse hold override (force-clear pulse while holding step).
