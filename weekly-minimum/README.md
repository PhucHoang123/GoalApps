# Weekly Minimum

Consistency without rigidity. An offline Windows desktop app built with Tauri 2, React, and TypeScript.

## Run and build

Install Node.js 22 or later, pnpm, stable Rust, Visual Studio C++ Build Tools (Desktop development with C++), and Microsoft Edge WebView2. Windows 11 normally includes WebView2.

```powershell
pnpm install
pnpm test
pnpm build
```

For desktop development, keep `pnpm dev` running in one terminal, then run `pnpm tauri dev` in another. For a desktop executable and Windows installer:

```powershell
pnpm build
pnpm tauri build
```

The executable is `src-tauri/target/release/weekly-minimum.exe`; the installer is under `src-tauri/target/release/bundle/nsis/`. Run the setup executable to install for your Windows user. Builds are unsigned. The installed app works offline; initial dependency downloads and installer packaging need internet. The default Tauri installer can bootstrap WebView2 when missing; install that runtime ahead of time for an offline machine.

If Cargo cannot write its global cache, set `$env:CARGO_HOME="$PWD\.cargo-cache"` before building. If pnpm reports ignored esbuild scripts, run `pnpm approve-builds` and allow esbuild.

The same frontend and Rust source can target macOS or Linux with the appropriate Tauri prerequisites. Change `bundle.targets` from `nsis` to the platform’s target; build on that platform. This delivery was developed for Windows.

## Using the app

- Use + and − for each goal’s increment. Click the large progress number to enter an exact weekly total and optional note.
- The ··· menu edits a goal’s name, target, unit, icon, color, and increment. Custom units are supported. Arrows reorder cards.
- Targets and units are snapshots per week. Editing the current week updates the template for future weeks; editing a past week affects that week only. Historical progress is never cleared by a target change.
- Archive and Delete both retire the future template, preserving the selected week’s card and every historical record. Restore retired goals in Settings. This is intentionally a recoverable deletion.
- Undo restores the state before the last change in this session. Reset progress asks for confirmation and affects only the selected week.
- The app creates a fresh current week on launch and checks for rollover every 30 seconds while open. It uses local calendar dates, including across daylight saving and year boundaries. Unopened weeks are created when browsed; they are not counted as missed commitments.
- Changing the week start day preserves old periods; newly generated periods can overlap those old periods. History uses each period’s stored start date.
- Overall completion is the equally weighted average of each goal’s progress / target. Percentages may exceed 100%; bars fill at 100%. There are no streaks, timers, accounts, or notifications.
- Pin or Settings → Always on top keeps the desktop window above other apps. Resize down to 360 pixels wide for a compact view.
- JSON export is a complete backup, including notes and preferences. JSON import validates then replaces local data with confirmation. CSV is a historical summary export, not an import format.

## Persistence and recovery

The desktop app stores `weekly-minimum.json` in Tauri’s per-user app-data directory (normally `%APPDATA%\com.weeklyminimum.desktop` on Windows). Writes are serialized and atomically replace the file. A `weekly-minimum.backup.json` copy retains the preceding save. Errors remain visible; the app never reports a failed save as successful. Keep the app open until “Saved on this device” appears before shutting down. Use one running instance at a time.

If the primary file contains damaged JSON, the native loader tries the backup. For a structurally invalid backup or other load failure, the app stops rather than overwriting your data. Close the app, preserve both files, and restore a known-good JSON export as `weekly-minimum.json`.

Browser preview uses localStorage for testing, separate from native data. It does not control window pinning. No fonts or other assets are loaded from the internet.

## Structure and verification

- `src/model.ts`: calendar dates, week snapshots, calculations, logging, import validation.
- `src/App.tsx`: dashboard, history, settings, goal editor, exact logging, undo.
- `src/style.css`: responsive light/dark design and reduced-motion support.
- `src-tauri/src/main.rs`: native load/save commands with atomic writes and backup.
- `src/model.test.ts`: calculations, year rollover, snapshots, archive, JSON round trip.
- `ui-test.cjs`: built frontend integration checks with Playwright and Chrome.
- `native-test.cjs`: Tauri WebView2 startup, restart persistence, and pin command checks, with separate test data.

To run UI checks, install Chrome, then run `node ui-test.cjs` after `pnpm build`. Playwright is included as a development dependency. For native checks, first run `pnpm tauri build --debug --no-bundle`, then `node native-test.cjs`. Native checks use a temporary debugging port and a debug-only data-directory override for the test process. Tests do not touch your normal app data. Run `cargo test --manifest-path src-tauri/Cargo.toml` for the native atomic-write and backup filesystem test.

The runtime has no network calls. Dependencies and the build configuration follow the [Tauri 2 configuration reference](https://v2.tauri.app/reference/config/) and [window API](https://tauri.app/reference/javascript/api/namespacewindow/).
