# Desktop Hero

Hero as a Windows desktop companion. A side project that lives beside the game and does not touch its Vite build.

She walks and idles on the taskbar, chases the pointer, digs into a taskbar entry to bring that app forward and pops out on its title bar, perches on windows (riding along when one is dragged, falling when it closes or minimizes), and can be picked up and thrown.

## Run

```powershell
cd C:\dev\Exploritaire\desktop-hero
npm install
npm start
```

Quit from the tray icon (the Hero head near the clock). The tray menu also has "Dig into an app", "Call Hero back", size, pause, and switches for unprompted digging and window nudging.

Options after `npm start --`: `--size=140`, `--no-autodig`, `--no-bump`, `--ignore-fullscreen`.

If `npm start` says the Electron binary is missing, run `node node_modules/electron/install.js` once.

## Interacting

- Move the pointer near the platform she is on and she chases it; stop near her and she sniffs and barks.
- Click her for a trick. Double-click her on the taskbar to make her dig into an app.
- Drag her to pick her up, release while moving to throw her.
- Leave the pointer alone for a while and she lies down and sleeps.

## How it works

- `src/main.js`: Electron main process. One transparent, always-on-top, focus-less overlay per display. Overlays are click-through (`setIgnoreMouseEvents` with forwarding) except while the pointer is over one of Hero's painted pixels.
- `overlay/`: draws the current frame and particles, and hit-tests the pointer against a small alpha mask of the frame.
- `src/hero.js`: behaviour and physics, in physical pixels. Speeds are in DIP and scaled by the monitor she is on, so she looks the same at 100% and 200%.
- `src/world.js`: turns window rects into platforms. Each visible top-level window's top edge is a platform, minus the parts covered by windows in front of it. Windows with no headroom above them (maximized) are not perches; digging into one makes her hang under its title bar and drop.
- `native/HeroHelper.cs`: a C# sidecar compiled on first launch with the .NET Framework's built-in `csc.exe` (no SDK needed) into `native/bin/`. It is per-monitor DPI aware and answers over stdin/stdout: window list in z-order (DWM frame bounds), taskbar rects (`SHAppBarMessage` plus secondary taskbars), taskbar entries (UI Automation, which on Windows 11 exposes each entry's window handle), foreground/fullscreen state, activating a window the way a taskbar click does, and nudging a window. Rebuild it with `npm run helper`.
- Fullscreen: when the foreground app covers its monitor (or Windows reports a D3D fullscreen/presentation state), that display's overlay hides and Hero pauses if she is on it.

Art: Hero's painted platforming suite (`suite-v1`) and idle set (`idle-v2`) are read directly from `public/assets/runtime/characters/hero/platforming/`. No new art was made; the desktop-only sequences (standing/seated breath, held) reuse existing frames.

## Tests

```powershell
npm test
```

Unit tests cover platform building, occlusion, landing, riding a dragged window, falling when it closes, the dig-and-emerge flow, hanging under a maximized title bar, and throwing. `electron . --selftest --selftest-out=<dir>` runs for a few seconds, logs Hero's state and saves a capture of each overlay.
