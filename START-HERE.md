# Weekly Minimum for Windows

Open **Weekly Minimum.exe** to run the app. It is a real Tauri desktop application with embedded assets; no development server or account is needed. Windows 11 normally already has the required Microsoft Edge WebView2 runtime.

To install a copy and add a Start menu shortcut, keep the executable and `Install-Weekly-Minimum.ps1` together, open PowerShell in this folder, and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\Install-Weekly-Minimum.ps1
```

This installs only for your user and does not require administrator access. Close the app before updating it. You can instead keep the executable anywhere convenient and run it directly.

Use +/− to log an increment, or click a progress number to enter an exact total and note. Use each card’s ··· menu to edit its target, unit, icon, color, and increment. Archived/deleted goals stop appearing in future weeks; current and historical records remain intact. Restore goals in Settings.

Settings also contains theme, week start day, always on top, JSON backup/restore, and CSV summary export. History lets you browse and edit past weeks. Everything saves locally in your user app-data folder.

The source archive includes complete running, testing, and build instructions in `README.md`. To create a standard Windows setup executable on your development machine, run `pnpm install`, `pnpm build`, and `pnpm tauri build` in the extracted source folder. The NSIS installer will appear in `src-tauri/target/release/bundle/nsis/`.

The executable is unsigned. In this build environment, the NSIS packaging tool failed with Windows DLL relocation error 623; the standalone executable builds successfully, and the included install script provides per-user installation without NSIS.

Verified: TypeScript and production frontend build; four model tests for calculations, year rollover, snapshots, archiving, and JSON round trips; one Rust filesystem test for atomic save and backup; browser UI checks for adding, editing, deleting/archiving, logging, notes, compact sizing, and restart persistence; native Tauri checks for startup, local save, restart persistence, and pinning. Native integration checks used the desktop debug build with bundled assets and isolated test data. The install script is supplied for you to run and has not been executed against your user profile.
