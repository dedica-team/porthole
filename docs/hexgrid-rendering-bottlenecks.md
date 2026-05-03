# HexGrid Rendering Bottlenecks

**Datum:** 2026-05-03  
**Scope:** `client/src/components/HexGrid/*` mit Schwerpunkt auf `HexGrid.tsx`, `useThreeScene.ts`, Terrain-/Connection-/Landmark-Renderern.

## Kurzfazit

Die größten Performance-Probleme im aktuellen 3D-Rendering liegen nicht primär bei einzelnen Draw Calls, sondern bei zu groben Rebuild-Grenzen, unnötig wiederholter CPU-Arbeit und mehreren potenziellen Material-/Shader-Leaks.

Die wichtigsten Bottlenecks sind:

1. vollständige Tile-Rebuilds bei breiten Dependencies
2. vollständige Terrain-Rebuilds bei Tile-Änderungen
3. wiederholter Aufbau von Tile-Lookup-Maps in Connection-/Arrow-Pfaden
4. doppelte Raycast-Arbeit im Brush-Modus
5. Material-/Shader-Leaks bei Landmarks und Process-Arrows
6. GPU-Fillrate-Kosten durch `antialias`, `devicePixelRatio <= 2`, Tone Mapping und CSS2D-Overlay

## Untersuchte Dateien

- `client/src/components/HexGrid/HexGrid.tsx`
- `client/src/components/HexGrid/useThreeScene.ts`
- `client/src/components/HexGrid/tileGeometry.ts`
- `client/src/components/HexGrid/terrainUtils.ts`
- `client/src/components/HexGrid/terrainRenderers.ts`
- `client/src/components/HexGrid/ProcessArrowRenderer.ts`
- `client/src/components/HexGrid/connectionRenderers.ts`
- `client/src/components/HexGrid/connections/*`
- `client/src/components/HexGrid/renderers/*`
- `client/src/components/HexGrid/landmarks/landmarkUtils.ts`

## Datengrundlage

Vorhandene Beispielkarten:

- `data/json/maps/4f9e5ce2-db02-420f-b6ad-f276ee01a667.json`
  - 2500 Tiles
  - 2 Landmarken
  - 1 Connection
- `data/json/maps/c7b1f47c-f757-3242-96ad-fa057795d0a1.json`
  - 217 Tiles
  - 15 Landmarken
  - 10 Connections

Terrain-Verteilung der größten Beispielkarte:

- `WATER`: 2246
- `BEACH`: 140
- `GRASS`: 92
- `ROCKS`: 15
- `SWAMP`: 7

## Bottlenecks im Detail

### 1. Vollständiger Tile-Rebuild

**Betroffene Stellen:**
- `HexGrid.tsx` Tile-Effekt, ca. Zeilen 255-385
- `tileGeometry.ts` `buildTileGeo(...)`
- `mergeGeometries(...)` für Top, Sides und Edge-Layer

**Beobachtung:**
Bei Änderungen an `map.map` oder `hideDecorations` werden alle Tile-Geometrien neu aufgebaut und anschließend mehrfach zusammengeführt.

**Warum teuer:**
- pro Tile mehrere neue `BufferGeometry`-Instanzen
- viele neue `Float32Array`-Allokationen
- mehrere `mergeGeometries(...)`-Durchläufe
- zusätzlicher Dispose-/GC-Druck

**Auswirkung:**
Hohe CPU-Spikes und potenziell sichtbare Hänger auf großen Karten, besonders bei häufigen Updates.

**Priorität:** sehr hoch

---

### 2. Vollständiger Terrain-Rebuild

**Betroffene Stellen:**
- `HexGrid.tsx` Terrain-Effekt, ca. Zeilen 498-554
- `terrainRenderers.ts`
- `renderers/*`

**Beobachtung:**
Bei Änderungen an `map.map.tiles` oder `hideDecorations` werden alle Terrain-Renderer neu initialisiert, für alle Tiles ausgeführt und anschließend geflusht.

**Warum teuer:**
- vollständige Iteration über alle Tiles
- CPU-Aufwand trotz Instancing/Batches weiterhin komplett neu
- neue GPU-Objekte für Deko-Layer

**Auswirkung:**
Zweiter großer CPU-Hotspot nach dem Tile-Mesh-Rebuild.

**Priorität:** sehr hoch

---

### 3. Wiederholter Tile-Lookup-Aufbau in Connection-/Arrow-Pfaden

**Betroffene Stellen:**
- `connections/StreetRenderer.ts`
- `connections/ArrowRenderer.ts`
- `connections/resolvePoints.ts`
- `ProcessArrowRenderer.ts`

**Beobachtung:**
Mehrere Renderer bauen für jede Connection bzw. jeden Update-Lauf erneut eine `Map<string, HexTile>` aus allen Tiles auf.

**Warum teuer:**
- unnötige O(tiles)-Vorarbeit pro Connection
- unnötige Wiederholung derselben Lookup-Struktur

**Auswirkung:**
Skaliert schlecht mit steigender Connection-Anzahl oder häufigen Rebuilds.

**Priorität:** hoch

---

### 4. Doppelte Raycast-Arbeit im Brush-Modus

**Betroffene Stellen:**
- nativer Pointer-Move-Listener in `HexGrid.tsx`
- React-`onPointerMove` in `HexGrid.tsx`
- native Registrierung in `useThreeScene.ts`

**Beobachtung:**
Im Brush-Modus existieren zwei Pointer-Move-Pfade, die beide Raycasting auf `merged.tops` ausführen.

**Warum teuer:**
- pro Mausbewegung potenziell doppeltes Picking
- Logik verhindert teils nur doppelte Wirkung, nicht doppelte Arbeit

**Auswirkung:**
Spürbare Interaktionskosten beim schnellen Malen oder Draggen.

**Priorität:** hoch

---

### 5. Material-/Shader-Leaks bei Landmarks

**Betroffene Stellen:**
- Cleanup im Landmark-Effekt in `HexGrid.tsx`
- `landmarks/landmarkUtils.ts`
- mehrere Landmark-Renderer mit `glowMat(...)`, `statusLight(...)`, `namePlane(...)`

**Beobachtung:**
Beim Cleanup werden Geometrien entsorgt, aber normale Mesh-Materialien nicht systematisch freigegeben.

**Warum teuer:**
- individuelle Shader-/Material-Instanzen bleiben potenziell im Speicher
- bei wiederholten Landmark-Rebuilds steigt GPU- und Material-Druck

**Auswirkung:**
Langsame Performance-Degradation und potenziell steigender Speicherverbrauch.

**Priorität:** hoch

---

### 6. Material-/Geometry-Leaks bei `ProcessArrowRenderer`

**Betroffene Stellen:**
- `ProcessArrowRenderer.ts`

**Beobachtung:**
Geometrien werden gesammelt und disposed, aber neu erzeugte Materialien für Pfeile und Label-Meshes werden nicht vollständig analog entsorgt.

**Warum teuer:**
- wiederholte Stage-Updates können Material-Reste hinterlassen

**Auswirkung:**
Schleichender VRAM-/Material-Leak.

**Priorität:** mittel bis hoch

---

### 7. GPU-Fillrate durch Renderer-Setup

**Betroffene Stellen:**
- `useThreeScene.ts`

**Beobachtung:**
Der Renderer verwendet:

- `antialias: true`
- `setPixelRatio(Math.min(window.devicePixelRatio, 2))`
- `ACESFilmicToneMapping`
- CSS2D-Overlay zusätzlich zum WebGL-Render

**Warum teuer:**
- höhere Pixelzahl bei DPR 2
- MSAA erhöht Renderkosten
- Tone Mapping und Transparenz kosten zusätzliche GPU-Zeit
- zweiter Renderpfad für CSS2D

**Auswirkung:**
Auf HiDPI-Geräten oder schwächeren GPUs kann die Szene GPU-limitiert werden.

**Priorität:** mittel bis hoch

---

### 8. Permanenter rAF-Loop trotz geringer Aktivität

**Betroffene Stellen:**
- `useThreeScene.ts` `animate(...)`

**Beobachtung:**
Auch wenn keine Draw Calls stattfinden, bleibt der `requestAnimationFrame`-Loop aktiv und führt u. a. `controls.update()` sowie `Stats`-Messung aus.

**Warum teuer:**
- konstante Idle-CPU-Last
- sichtbarer auf 120/144-Hz-Displays

**Auswirkung:**
Kein Hauptbottleneck, aber unnötige Grundlast.

**Priorität:** mittel

---

### 9. CSS2D-Labels als zusätzlicher DOM-Kostenfaktor

**Betroffene Stellen:**
- `useThreeScene.ts`
- Metric-Overlay-Effekt in `HexGrid.tsx`

**Beobachtung:**
Metrik-Labels werden als DOM-Elemente via `CSS2DRenderer` erzeugt und pro Render mitgeführt.

**Warum teuer:**
- zusätzlicher Scene-Traversal
- DOM-/Style-/Layout-Kosten
- schlechtere Skalierung als reine WebGL-Labels

**Auswirkung:**
Vor allem bei vielen Landmark-Labels oder häufigen Updates relevant.

**Priorität:** mittel

---

### 10. Unnötige CPU-Arbeit bei Ring-/Arrow-Geometrie

**Betroffene Stellen:**
- Highlight-Rings in `HexGrid.tsx`
- `ProcessArrowRenderer.ts`
- `connections/StreetRenderer.ts`
- `connections/ArrowRenderer.ts`

**Beobachtung:**
Mehrere Geometrien werden bei jedem Update neu erzeugt; teils werden `computeVertexNormals()` auf Geometrien angewendet, die mit unlit Materialien gerendert werden.

**Warum teuer:**
- zusätzliche CPU-Zeit ohne visuellen Mehrwert

**Auswirkung:**
Kleinere, aber unnötige Zusatzlast.

**Priorität:** niedrig bis mittel

## Positive Befunde

Bereits vorhandene Optimierungen:

- Tiles werden zu wenigen großen Meshes zusammengeführt
- viele Terrain-Renderer nutzen `InstancedMesh` oder Batcher
- `hideDecorations` reduziert Last erheblich
- Render-Loop rendert nicht blind jede rAF-Iteration vollständig
- mehrere Materialien werden geteilt statt pro Tile neu erzeugt

## Priorisierte Empfehlungen

### Sofortmaßnahmen

1. **Rebuild-Grenzen verkleinern**
   - `map.map`-Abhängigkeit enger fassen
   - Tile-, Terrain- und Connection-Layer getrennt inkrementell aktualisieren

2. **Zentrale Tile-Lookup-Map wiederverwenden**
   - einmal pro Tile-Update erzeugen
   - an Connection-/Arrow-/Resolve-Pfade weiterreichen

3. **Doppelte Pointer-Pfade reduzieren**
   - im Brush-Modus nur einen Picking-Pfad aktiv halten

4. **Cleanup für Materialien vervollständigen**
   - Landmark- und Process-Arrow-Materialien systematisch `dispose()`n

### Zweite Welle

5. **GPU-Qualität optional absenken**
   - dynamische Pixel Ratio
   - optional `antialias` deaktivierbar
   - Tone Mapping konfigurierbar

6. **CSS2D-Overlays begrenzen**
   - nur bei Bedarf rendern
   - alternative WebGL-/Sprite-Labels prüfen

7. **Idle-Loop weiter beruhigen**
   - nur bei Aktivität kontinuierlich animieren
   - sonst sleep-/wake-orientierter Renderansatz

## Empfohlene Reihenfolge für Umsetzung

1. Material-/Shader-Leaks beheben
2. doppeltes Brush-Picking entfernen
3. Tile-Lookup zentralisieren
4. Tile-/Terrain-Rebuilds inkrementeller machen
5. GPU-Qualitätsprofil einführen

## Verifikation

- Der Client ließ sich im aktuellen Stand erfolgreich bauen.
- Die Analyse basiert auf dem tatsächlich vorhandenen Code und den vorhandenen JSON-Beispielkarten.

## Nächste sinnvolle Folge-Datei

Falls aus den Befunden konkrete Maßnahmen abgeleitet werden sollen, bietet sich anschließend ein separates Umsetzungsdokument an, z. B.:

- `docs/hexgrid-rendering-optimization-plan.md`

