# APEX HYPERDRIVE 3D

3D-Rennspiel im Browser. Eine einzige HTML-Datei, Three.js r160 vom CDN, kein Server nötig.

## Spielen
`dist/index.html` im Browser öffnen (Internet nötig, weil Three.js vom CDN geladen wird).

## Bauen
```
python tools/build.py
```
Setzt alle Dateien aus `src/js/` (alphabetisch sortiert) an der Stelle `/*__GAME_JS__*/` in `src/shell.html` ein und schreibt `dist/index.html`.
Nie `dist/index.html` direkt bearbeiten, immer `src/`.

## Aufbau
| Datei | Inhalt |
|---|---|
| `src/shell.html` | HTML und CSS: Intro, Menü, HUD, Dialoge |
| `src/js/1_core.js` | Renderer, Bildqualität, Texturen, Partikel, Ton |
| `src/js/2_cars.js` | Autos: Daten, Fahrleistung, 3D-Modell |
| `src/js/3_tracks.js` | Strecken: Geometrie, Ideallinie, Rampen, Münzen, Hindernisse, Szene |
| `src/js/3b_env.js` | Gelände, Himmel, Wolken, Bäume |
| `src/js/4_race.js` | Rennen: Fahrphysik, Gegner, Kollisionen, Kamera, Sektoren |
| `src/js/4b_endless.js` | Countdown-Modus: Wetter, Reifen, Boxenstopp, Regen-Effekte, Strategie der Gegner (eigene Reifen, Boxenstopps, Fahrfehler) |
| `src/js/4c_line.js` | Ideallinie |
| `src/js/5_ui.js` | Showroom, Intro, Menü, HUD, Bestenliste, Eingabe, Hauptschleife |

## Tests (optional)
Die Skripte in `test/` steuern das Spiel mit Playwright in einem Chrome ohne Fenster. Sie wurden unter Linux geschrieben und sind unter Windows nicht erprobt.
```
pip install playwright
npm install --prefix vendor three@0.160.0
set CHROME=C:\Program Files\Google\Chrome\Application\chrome.exe
python test/smoke.py
```
`tools/*.mjs` sind kleine Fahrphysik-Simulationen für Node (`node tools/wetosc.mjs`).
