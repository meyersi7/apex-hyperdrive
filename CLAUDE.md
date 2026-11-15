# APEX HYPERDRIVE 3D – Hinweise für Claude Code

## Regeln
- Mit Silvio auf Deutsch schreiben, Schweizer Schreibweise (ss statt ß), kurz und direkt, Ergebnis zuerst.
- Quellcode liegt in `src/`. `dist/index.html` wird gebaut (`python tools/build.py`) und nie von Hand bearbeitet.
- Das Spiel bleibt eine einzige HTML-Datei ohne Server. Three.js 0.160 kommt per importmap von cdn.jsdelivr.net; keine weiteren externen Dateien (Bilder, Töne) nachladen, alles wird im Code erzeugt.
- Die Autos sind erfundene Modelle (Vortex V12, Comet X16, Polaris R, Inferno GT-R). Keine echten Marken oder Modelle nachbauen.
- Die Dateien in `src/js/` werden alphabetisch zu einem ES-Modul zusammengesetzt: Funktionen sind überall sichtbar, `const`/`class` erst nach ihrer Zeile.

## Vorzeichen in der Fahrphysik (`4_race.js`)
- Vorwärts = (sin h, cos h), rechts = (−cos h, sin h). Eine Rechtskurve verkleinert `heading`.
- `p.vlat` > 0: Auto bewegt sich nach rechts. `p.yawRate` > 0: dreht nach rechts. `lat` > 0: rechts der Streckenmitte.
- Physik in Teilschritten von 240 Hz. `race.gripMul` (Reifen, Abnutzung, Nässe) skaliert den Grip, `race.slick` lockert die Fahrhilfen auf nasser Strecke.
- `RAINP` enthält die Stellwerte für Nässe: `rear` darf nicht positiv werden (weniger Grip hinten als vorn lässt das Auto pendeln), `yaw` dämpft den Schwimmwinkel, `wag`/`wagVis` steuern das sichtbare Rutschen bei wenig Grip.

## Gegner (`updateAI` in `4_race.js`)
- Kein Fahrphysik-Modell: Die Gegner fahren auf der Strecke entlang (`s`, `lat`), mit Zieltempo aus Kurvenradius und Bremsweg und Ziellinie aus Ideallinie + `bias`.
- Im Endlos-Modus: eigene Reifen (`a.tyre`, `a.cond`, `a.gripF`), Boxenstopps und Fahrfehler über `endAiTick`, `aiPitCall`, `endAiDrive` in `4b_endless.js`. Jeder Fahrer würfelt pro Lauf `risk` und `gamble`. Ab 400 m Abstand zieht `rubFar` die Gegner zum Spieler zurück. Namensschild mit Reifen und Abnutzung (`drawAiTag`, zeichnet nur bei Wechsel oder 10-%-Schritt neu), HUD-Zeile `eRivA`/`eRivB` zeigt den nächsten Gegner vor und hinter dir.

## Leistung
- Zielgerät ist ein Laptop mit schwacher Grafik. Keine `backdrop-filter` und keine animierten Vollbild-Ebenen im HUD während des Rennens.
- HUD nur schreiben, wenn sich ein Wert ändert (`setT`, `setH`, `hudC`).
- Gegner werden mit `buildCar(spec, { lite: true })` gebaut (Kleinteile pro Material zusammengefasst).
- Regen-Effekte skalieren mit `E.fxQ` (sinkt, wenn die Bildrate fällt).

## Prüfen
- `window.__apex` stellt Testhaken bereit (`setMode('test')`, `step(dt, n)`, `render()`, `race`, `RAINP`, ...).
- `test/line.py` fährt Runden nur nach den Farben der Ideallinie; `test/endless.py` und `test/smoke.py` sind die Regressionstests. Siehe README für die Einrichtung.

## Veröffentlicht als
claude.ai-Artifact «APEX HYPERDRIVE 3D». Die Bestenliste nutzt dort eine geteilte Datenbank (`claude.use('db')`, Sammlungen `scores` und `endless`); lokal greift der Ersatz über localStorage.
