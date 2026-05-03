# Plan: HexGrid Rendering Optimization

> Erstellt: 2026-05-03

## Ziel

Die Rendering-Pipeline des HexGrid soll auf großen Karten stabiler, speichersicherer und reaktionsschneller werden, ohne die bestehende visuelle Sprache oder die öffentlichen UI-Flows unnötig zu verändern.

Der Fokus liegt auf drei Zielen:

1. **Stabilität erhöhen** – Material-, Geometry- und Shader-Leaks beseitigen
2. **CPU-Last senken** – unnötige Rebuilds, doppelte Picking-Arbeit und wiederholte Lookup-Vorarbeit reduzieren
3. **GPU-/Laufzeitkosten steuern** – Renderer-Qualität, CSS2D-Kosten und Idle-Last besser kontrollieren

---

## Scope

Primär betroffen sind:

- `client/src/components/HexGrid/HexGrid.tsx`
- `client/src/components/HexGrid/useThreeScene.ts`
- `client/src/components/HexGrid/ProcessArrowRenderer.ts`
- `client/src/components/HexGrid/tileGeometry.ts`
- `client/src/components/HexGrid/terrainRenderers.ts`
- `client/src/components/HexGrid/terrainUtils.ts`
- `client/src/components/HexGrid/connections/*`
- `client/src/components/HexGrid/renderers/*`
- `client/src/components/HexGrid/landmarks/*`

Referenzanalyse:

- `docs/hexgrid-rendering-bottlenecks.md`

---

## Leitprinzipien

1. **Zuerst Leaks und doppelte Arbeit beseitigen**
   - Kleine, sichere Änderungen mit sofortigem Effekt vor größeren Architekturumbauten.

2. **Layer getrennt behandeln**
   - Tiles, Terrain, Connections, Landmarken und Overlays sollen möglichst unabhängig aktualisiert werden.

3. **Bestehende API und UX erhalten**
   - Keine unnötigen Änderungen an Store-Strukturen oder Nutzerinteraktionen, solange dieselbe Wirkung intern günstiger erreicht werden kann.

4. **Messbar optimieren**
   - Jede Phase soll mit Build, Smoke-Test und gezielter Laufzeitbeobachtung abgesichert werden.

---

## 1. Sofortmaßnahmen: Stabilität & redundante Arbeit

### 1.1 Landmark-Cleanup vervollständigen

**Dateien:**
- `client/src/components/HexGrid/HexGrid.tsx`
- `client/src/components/HexGrid/landmarks/landmarkUtils.ts`
- ggf. einzelne Renderer in `client/src/components/HexGrid/landmarks/*`

**Problem:**
Beim Tear-down des Landmark-Layers werden Geometrien entsorgt, Mesh-Materialien aber nicht systematisch freigegeben.

**Maßnahmen:**
- Cleanup im Landmark-Effekt so erweitern, dass auch `material` korrekt `dispose()`t wird
- rekursiv sowohl `Mesh`, `Line`, `Sprite` als auch Mehrfachmaterialien behandeln
- dabei keine geteilten, globalen Singleton-Materialien versehentlich mehrfach zerstören

**Erfolgskriterium:**
- keine offensichtliche Zunahme von Material-/Programmanzahl nach wiederholten Landmark-Updates
- Build bleibt grün

### 1.2 `ProcessArrowRenderer` speichersicher machen

**Dateien:**
- `client/src/components/HexGrid/ProcessArrowRenderer.ts`

**Problem:**
Arrow- und Label-Materialien werden pro Update neu erzeugt, aber nicht vollständig mit entsorgt.

**Maßnahmen:**
- neben Geometrien auch dynamisch erzeugte Materialien sammeln und freigeben
- Label-Planes und Arrow-Meshes konsistent bereinigen
- Cache-Lebensdauer für Label-Texturen bewusst dokumentieren

**Erfolgskriterium:**
- wiederholte Stage-Wechsel erhöhen Materialzahl nicht dauerhaft

### 1.3 Doppelte Brush-Pointer-Pfade entfernen

**Dateien:**
- `client/src/components/HexGrid/HexGrid.tsx`
- optional `client/src/components/HexGrid/useThreeScene.ts`

**Problem:**
Im Brush-Modus laufen nativer Pointer-Move und React-`onPointerMove` parallel und machen beide Raycasts.

**Maßnahmen:**
- genau einen Picking-Pfad für Brush-Drag aktiv halten
- den anderen Pfad entfernen oder auf Nicht-Brush-Szenarien begrenzen
- sicherstellen, dass OrbitControls im Brush-Modus weiterhin korrekt deaktiviert/aktiviert werden

**Erfolgskriterium:**
- keine doppelte Tile-Aktion bei Drag
- geringere Pointer-Kosten bei schnellen Brush-Bewegungen

### 1.4 Tile-Lookup zentralisieren

**Dateien:**
- `client/src/components/HexGrid/HexGrid.tsx`
- `client/src/components/HexGrid/connections/resolvePoints.ts`
- `client/src/components/HexGrid/connections/StreetRenderer.ts`
- `client/src/components/HexGrid/connections/ArrowRenderer.ts`
- `client/src/components/HexGrid/ProcessArrowRenderer.ts`

**Problem:**
Mehrere Renderer bauen dieselbe `Map<string, HexTile>` immer wieder neu auf.

**Maßnahmen:**
- zentrale Tile-Lookup-Map aus `map.map.tiles` einmal erzeugen
- als Parameter an Connection-/Arrow-Helfer weiterreichen
- `resolvePoints(...)` so umbauen, dass kein eigener Map-Aufbau mehr nötig ist

**Erfolgskriterium:**
- pro Layer-Update nur noch ein Lookup-Aufbau
- keine Verhaltensänderung in Connection-Geometrie

---

## 2. CPU-Hotspots: Rebuilds verkleinern

### 2.1 Tile-Rebuild-Dependencies enger fassen

**Dateien:**
- `client/src/components/HexGrid/HexGrid.tsx`

**Problem:**
Der Tile-Effekt hängt aktuell zu grob an `map.map`.

**Maßnahmen:**
- Dependency auf die tatsächlich relevante Tile-Datenstruktur eingrenzen
- prüfen, welche Unterzustände wirklich einen kompletten Tile-Rebuild benötigen
- Rebuilds für rein visuelle Prozess-Highlights weiterhin über Color-Buffer-Patching abbilden

**Erfolgskriterium:**
- weniger Full-Rebuilds bei State-Änderungen außerhalb der Tile-Geometrie

### 2.2 Terrain-Layer von Tile-Layer stärker entkoppeln

**Dateien:**
- `client/src/components/HexGrid/HexGrid.tsx`
- `client/src/components/HexGrid/terrainRenderers.ts`
- `client/src/components/HexGrid/renderers/*`

**Problem:**
Terrain-Deko wird bei Tile-Änderungen vollständig neu aufgebaut.

**Maßnahmen:**
- getrennt prüfen, welche Änderungen wirklich Terrain-Deko invalidieren
- zunächst Rebuild-Auslöser verkleinern, bevor echte Inkrementalität eingeführt wird
- mittelfristig vorbereiten, dass Renderer pro Tile oder Terrain-Gruppe gezielter aktualisiert werden können

**Erfolgskriterium:**
- weniger Komplettdurchläufe über alle Tiles
- keine Regression in `hideDecorations`

### 2.3 Geometrieaufbau weiter glätten

**Dateien:**
- `client/src/components/HexGrid/tileGeometry.ts`
- `client/src/components/HexGrid/HexGrid.tsx`

**Problem:**
Der Tile-Build erzeugt viele temporäre Geometrien und Arrays.

**Maßnahmen:**
- prüfen, ob vorberechnete Templates stärker direkt in zusammenhängende Ziel-Arrays geschrieben werden können
- unnötige Zwischenobjekte reduzieren
- Ring-/Overlay-Geometrie nur dann normalberechnen, wenn das Material Beleuchtung benötigt

**Erfolgskriterium:**
- weniger GC-Druck bei großen Rebuilds

---

## 3. Renderer-Layer: Connections, Overlays, Labels

### 3.1 Connection-Renderer auf gemeinsame Hilfsdaten umstellen

**Dateien:**
- `client/src/components/HexGrid/connectionRenderers.ts`
- `client/src/components/HexGrid/connections/*`

**Problem:**
Connection-Pfade wiederholen ähnliche Vorarbeit mehrfach.

**Maßnahmen:**
- gemeinsame Hilfsdaten für Tile-Lookup und ggf. Pfadvorbereitung definieren
- vermeiden, dass jeder Renderer dieselben Kachelinformationen erneut zusammenstellt
- später prüfen, ob Process- und Normal-Connection-Rendering stärker gemeinsame Pfadlogik verwenden können

**Erfolgskriterium:**
- weniger redundante Vorarbeit pro Connection

### 3.2 CSS2D-Overlay kontrollierter einsetzen

**Dateien:**
- `client/src/components/HexGrid/useThreeScene.ts`
- `client/src/components/HexGrid/HexGrid.tsx`

**Problem:**
CSS2D führt zusätzliche Traversal- und DOM-Kosten ein.

**Maßnahmen:**
- CSS2D nur rendern, wenn tatsächlich CSS2D-Objekte vorhanden sind
- Metric-Overlay-Erzeugung bewusst auf konkrete Modi begrenzen
- mittel-/langfristig WebGL-Labels oder Text-Sprites als Alternative bewerten

**Erfolgskriterium:**
- kein zusätzlicher CSS2D-Pass im leeren Zustand

### 3.3 Connection-Picking langfristig skalierbarer machen

**Dateien:**
- `client/src/components/HexGrid/HexGrid.tsx`

**Problem:**
Connection-Klicks laufen linear über alle Connection-Objekte.

**Maßnahmen:**
- kurzfristig so belassen, wenn Dataset klein bleibt
- bei wachsender Connection-Zahl räumliche Vorfilterung oder ein dediziertes Picking-Layer prüfen

**Erfolgskriterium:**
- klare Eskalationsstrategie statt vorzeitigem Overengineering

---

## 4. Laufzeitprofil: GPU, Idle, Quality Settings

### 4.1 Qualitätsprofil für WebGL einführen

**Dateien:**
- `client/src/components/HexGrid/useThreeScene.ts`

**Problem:**
`antialias`, DPR bis 2 und Tone Mapping erhöhen GPU-Kosten deutlich.

**Maßnahmen:**
- optionales Qualitätsprofil einführen, z. B. `high`, `balanced`, `low`
- im ersten Schritt intern, ohne neue UI, über sinnvolle Defaults oder Flags steuerbar
- mögliche Hebel:
  - geringere Pixel Ratio
  - optional `antialias: false`
  - Tone Mapping vereinfachen oder konfigurierbar machen

**Erfolgskriterium:**
- schwächere Geräte können mit reduziertem Qualitätsprofil stabiler rendern

### 4.2 Idle-Loop beruhigen

**Dateien:**
- `client/src/components/HexGrid/useThreeScene.ts`

**Problem:**
Die rAF-Schleife läuft dauerhaft, auch wenn keine sichtbare Aktivität vorliegt.

**Maßnahmen:**
- prüfen, ob nach abgeschlossener Dämpfung und ohne Renderbedarf in einen sleep-/wake-orientierten Modus gewechselt werden kann
- `requestRender()` als expliziten Weckmechanismus nutzen
- `Stats` nur in Entwicklungsmodus oder optional aktivieren

**Erfolgskriterium:**
- niedrigere Idle-CPU-Last ohne sichtbare Ruckler bei Reaktivierung

---

## 5. Reihenfolge der Umsetzung

### Phase 1 – schnelle, sichere Gewinne

1. Landmark-Material-Cleanup
2. `ProcessArrowRenderer`-Cleanup
3. doppeltes Brush-Picking entfernen
4. Tile-Lookup zentralisieren

### Phase 2 – CPU-Spitzen reduzieren

5. Tile-Rebuild-Dependencies eingrenzen
6. Terrain-Rebuild-Auslöser verkleinern
7. unnötige Geometrie-/Normal-Arbeit reduzieren

### Phase 3 – Laufzeitprofil verbessern

8. CSS2D-Pass gezielt aktivieren
9. Qualitätsprofil für WebGL einführen
10. Idle-Loop entschärfen

---

## Validierung je Phase

Nach jeder Phase:

1. Client-Build ausführen
2. vorhandene Tests laufen lassen, soweit betroffen
3. manuell prüfen:
   - Brush-Modus
   - Tile-Selektion
   - Landmark-Rendering
   - Process-Stage-Wechsel
   - Metric-Overlay
4. Laufzeitmetriken vergleichen:
   - FPS
   - subjektive Interaktionslatenz
   - Material-/Geometrie-Anzahl in WebGL-Inspektion oder `renderer.info`

---

## Nicht-Ziele für die erste Optimierungsrunde

Folgende Themen sollen zunächst **nicht** Teil der ersten Welle sein:

- vollständiger Wechsel auf eine neue 3D-Architektur
- Einführung eines externen Scene-Graph-Frameworks
- tiefgreifende Umstrukturierung des globalen Stores
- vollständiges Rewriting aller Terrain-Renderer

Diese Themen können später erneut bewertet werden, falls die kleineren und mittleren Maßnahmen nicht ausreichen.

---

## Erwartetes Ergebnis

Nach Umsetzung von Phase 1 und 2 sollte das HexGrid:

- stabiler über längere Sitzungen laufen
- weniger CPU-Spitzen bei Updates erzeugen
- im Brush-Modus reaktionsschneller sein
- weniger unnötige Arbeit bei Connection- und Tile-Updates ausführen

Nach Phase 3 sollte zusätzlich die Laufzeit auf schwächeren oder HiDPI-Systemen kontrollierbarer werden.

