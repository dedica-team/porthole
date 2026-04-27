# Plan: Quality Metrics

> Erstellt: 2026-03-23
> Status: ✅ Vollständig implementiert

## Konzept

**Quality Metrics** sind kartenweite Definitionen (id, name, description), die
unabhängig von einzelnen Landmarks verwaltet werden. Für jedes Landmark kann
eine Metrik mit einem konkreten Wert, einer optionalen Link-URL sowie einem
Qualitätslevel (`NONE`, `OK`, `WARNING`, `ERROR`) belegt werden. Der
schlechteste aller aktiven Level eines Landmarks wird als _Gesamtstatus_
angezeigt: im Sidebar-Header und als kleines blinkendes Licht direkt am
3-D-Modell auf der Karte.

### Qualitätslevel-Hierarchie

| Level     | Farbe       | Bedeutung                          |
|-----------|-------------|------------------------------------|
| `NONE`    | Grau        | Metrik vorhanden, kein Wert gesetzt |
| `OK`      | Grün        | Alles in Ordnung                   |
| `WARNING` | Gelb/Orange | Warnung, Handlungsbedarf           |
| `ERROR`   | Rot         | Fehler, kritischer Zustand         |

_Worst-of_-Berechnung: `ERROR > WARNING > OK > NONE`.

---

## 1. Domain – Backend

### 1.1 Neue Klasse `QualityMetric`
**Datei:** `domain/QualityMetric.kt` _(neu)_

```kotlin
data class QualityMetric(
    val id: String,           // UUID
    val name: String,
    val description: String,
)
```

### 1.2 Neues Enum `QualityLevel`
**Datei:** `domain/QualityLevel.kt` _(neu)_

```kotlin
enum class QualityLevel { NONE, OK, WARNING, ERROR }
```

Reihenfolge entspricht aufsteigender Schwere; `ordinal` kann für
Worst-of-Vergleich genutzt werden.

### 1.3 Neue Klasse `LandmarkMetricEntry`
**Datei:** `domain/LandmarkMetricEntry.kt` _(neu)_

```kotlin
data class LandmarkMetricEntry(
    val metricId: String,       // references QualityMetric.id
    val value: String,          // frei wählbarer Anzeigewert (z.B. "99 %", "3 ms")
    val link: String? = null,   // optionale URL
    val level: QualityLevel = QualityLevel.NONE,
)
```

### 1.4 `Landmark.kt` erweitern
**Datei:** `domain/Landmark.kt`

Neues Feld mit Default:
```kotlin
val metrics: Map<String, LandmarkMetricEntry> = emptyMap(),
// Key = metricId für schnellen Zugriff
```

### 1.5 `MapState.kt` erweitern
**Datei:** `domain/MapState.kt`

```kotlin
val metrics: MutableMap<String, QualityMetric> = mutableMapOf(),
```

### 1.6 Hilfsfunktion `worstLevel`
**Datei:** `domain/QualityLevel.kt` (Companion-Funktion)

```kotlin
companion object {
    fun worstOf(entries: Collection<LandmarkMetricEntry>): QualityLevel =
        entries.maxByOrNull { it.level.ordinal }?.level ?: NONE
}
```

---

## 2. Application – Backend

### 2.1 `CreateMetricUseCase` _(neu)_
**Datei:** `application/CreateMetricUseCase.kt`

```
execute(mapId, name, description): MapState
```
- `name` nicht leer.
- Generiert UUID als `id`.
- Fügt zu `state.metrics` hinzu, speichert, broadcasted.

### 2.2 `EditMetricUseCase` _(neu)_
**Datei:** `application/EditMetricUseCase.kt`

```
execute(mapId, metricId, name?, description?): MapState
```
- Metrik muss existieren.
- Aktualisiert nur übergebene Felder, speichert, broadcasted.

### 2.3 `RemoveMetricUseCase` _(neu)_
**Datei:** `application/RemoveMetricUseCase.kt`

```
execute(mapId, metricId): MapState
```
- Entfernt Metrik aus `state.metrics`.
- Entfernt zugehörigen `LandmarkMetricEntry` aus **allen** Landmarks
  (`landmark.copy(metrics = landmark.metrics - metricId)`).
- Speichert, broadcasted.

### 2.4 `SetLandmarkMetricUseCase` _(neu)_
**Datei:** `application/SetLandmarkMetricUseCase.kt`

```
execute(mapId, landmarkId, metricId, value, link?, level): MapState
```
- Landmark und Metrik müssen existieren.
- Erstellt / ersetzt den `LandmarkMetricEntry` unter `metricId`.
- Speichert, broadcasted.

### 2.5 `ClearLandmarkMetricUseCase` _(neu)_
**Datei:** `application/ClearLandmarkMetricUseCase.kt`

```
execute(mapId, landmarkId, metricId): MapState
```
- Entfernt den Eintrag aus `landmark.metrics`.
- Speichert, broadcasted.

---

## 3. API – Backend

### 3.1 Request-DTOs
**Datei:** `adapter/in/web/MapController.kt`

```kotlin
data class CreateMetricRequest(val name: String, val description: String)
data class EditMetricRequest(val name: String?, val description: String?)
data class SetLandmarkMetricRequest(
    val value: String,
    val link: String?,
    val level: String,   // "NONE" | "OK" | "WARNING" | "ERROR"
)
```

### 3.2 Neue Endpunkte

| Methode  | Pfad                                                         | Use Case                    |
|----------|--------------------------------------------------------------|-----------------------------|
| `POST`   | `/api/maps/{id}/metrics`                                     | `CreateMetricUseCase`       |
| `PATCH`  | `/api/maps/{id}/metrics/{metricId}`                          | `EditMetricUseCase`         |
| `DELETE` | `/api/maps/{id}/metrics/{metricId}`                          | `RemoveMetricUseCase`       |
| `PUT`    | `/api/maps/{id}/landmarks/{landmarkId}/metrics/{metricId}`   | `SetLandmarkMetricUseCase`  |
| `DELETE` | `/api/maps/{id}/landmarks/{landmarkId}/metrics/{metricId}`   | `ClearLandmarkMetricUseCase`|

---

## 4. Persistence – Backend

EclipseStore serialisiert per Typname. Da alle neuen Klassen neu sind und
bestehende Klassen (`Landmark`, `MapState`) nur Felder mit Default-Werten
erhalten, ist **keine manuelle Migration nötig**. Das
`PersistenceTypeDictionary.ptd` wird beim nächsten Start automatisch
aktualisiert.

---

## 5. Tests – Backend

### 5.1 `CreateMetricUseCaseTest`
- Erfolgsfall: Metrik wird angelegt, `id` ist UUID, im State vorhanden.
- Fehler: `name` leer → Exception.

### 5.2 `EditMetricUseCaseTest`
- Erfolgsfall: Name und/oder Description aktualisiert.
- Fehler: `metricId` nicht gefunden → Exception.

### 5.3 `RemoveMetricUseCaseTest`
- Metrik wird aus `state.metrics` entfernt.
- Alle Landmark-Einträge für diese Metrik werden ebenfalls entfernt (Cascade).

### 5.4 `SetLandmarkMetricUseCaseTest`
- Erfolgsfall: Eintrag wird gesetzt (neu + überschreiben).
- Fehler: Landmark nicht gefunden.
- Fehler: Metrik nicht gefunden.
- Fehler: `level` ungültig.

### 5.5 `ClearLandmarkMetricUseCaseTest`
- Eintrag wird entfernt.
- Idempotent: kein Fehler, wenn kein Eintrag vorhanden.

### 5.6 `MapControllerTest` – neue Endpunkte
- HTTP 200 für alle CRUD-Pfade.
- HTTP 400 / 404 für ungültige Eingaben.

---

## 6. Client – Types (`types/map.ts`)

```typescript
export type QualityLevel = 'NONE' | 'OK' | 'WARNING' | 'ERROR';

export const QUALITY_LEVEL_ORDER: QualityLevel[] = ['NONE', 'OK', 'WARNING', 'ERROR'];

export const QUALITY_LEVEL_COLOR: Record<QualityLevel, string> = {
  NONE:    '#6b7280',   // gray-500
  OK:      '#22c55e',   // green-500
  WARNING: '#f59e0b',   // amber-500
  ERROR:   '#ef4444',   // red-500
};

export interface QualityMetric {
  id: string;
  name: string;
  description: string;
}

export interface LandmarkMetricEntry {
  metricId: string;
  value: string;
  link?: string;
  level: QualityLevel;
}

// Landmark – neues Feld:
// metrics?: Record<string, LandmarkMetricEntry>

// MapState – neues Feld:
// metrics: Record<string, QualityMetric>
```

Hilfsfunktion:
```typescript
export function worstLevel(entries: LandmarkMetricEntry[]): QualityLevel {
  return entries.reduce<QualityLevel>((worst, e) =>
    QUALITY_LEVEL_ORDER.indexOf(e.level) > QUALITY_LEVEL_ORDER.indexOf(worst)
      ? e.level : worst,
    'NONE'
  );
}
```

---

## 7. Client – API (`api/mapApi.ts`)

```typescript
// Metrik-Verwaltung
createMetric(mapId, name, description): Promise<MapState>
editMetric(mapId, metricId, name?, description?): Promise<MapState>
removeMetric(mapId, metricId): Promise<MapState>

// Landmark-Metrik-Einträge
setLandmarkMetric(mapId, landmarkId, metricId, value, level, link?): Promise<MapState>
clearLandmarkMetric(mapId, landmarkId, metricId): Promise<MapState>
```

---

## 8. Client – Store (`store/mapStore.ts`)

Keine strukturellen Änderungen nötig. `updateMap` / WS-Broadcast ersetzt den
vollständigen `MapState`, sodass `metrics` und die Landmark-Einträge automatisch
ankommen.

Hilfsselektor ergänzen:
```typescript
// Gibt den Worst-of-Level des ausgewählten Landmarks zurück
selectedLandmarkWorstLevel: (state) => {
  const lm = state.selectedLandmark;
  if (!lm?.metrics) return 'NONE';
  return worstLevel(Object.values(lm.metrics));
}
```

---

## 9. Client – UI

### 9.1 Neue Komponente `MetricsPanel.tsx`
**Datei:** `components/Sidebar/panels/MetricsPanel.tsx` _(neu)_

Zeigt alle kartenweiten Metriken als verwaltbare Liste:
- Name + Description mit Edit-Button (inline).
- Delete-Button mit Bestätigungsdialog.
- „+ Add Metric"-Formular am Ende.
- Tab/Panel-Einstieg über `sidebarPanel = 'metrics'` im Store.

### 9.2 `LandmarkPanel.tsx` erweitern

Neuer Abschnitt **„Quality Metrics"** unterhalb der bestehenden Felder:

```
┌─────────────────────────────────────────────┐
│  Quality Metrics              [Worst: 🔴]   │
│  ──────────────────────────────────────────  │
│  🟢 Availability    99.9 %    🔗 [link]      │
│  🟡 Latency         142 ms    🔗 [link]      │
│  🔴 Error Rate      5.2 %     🔗 [link]      │
│                                              │
│  [+ Add metric value]                        │
└─────────────────────────────────────────────┘
```

- Jede Zeile zeigt ein farbiges Bullet (`●`) entsprechend `QualityLevel`.
- Bullet-Farben gemäß `QUALITY_LEVEL_COLOR`.
- Klick auf eine Zeile öffnet ein Inline-Formular: value, link, level.
- Der **Gesamtstatus** (Worst-of) wird als Badge oben rechts im Abschnitt
  angezeigt.

### 9.3 `Sidebar.tsx` erweitern

- Neuer Tab-Button „Metrics" (Icon: `BarChart2` aus lucide-react).
- Rendert `<MetricsPanel>` wenn `sidebarPanel === 'metrics'`.
- Props um Metric-CRUD-Callbacks erweitern.

### 9.4 `AppShell` / Navbar

Optional: Metric-Tab auch in der Navbar oder als separater Button, wenn
der Sidebar-Platz begrenzt ist.

---

## 10. Client – 3-D-Modelle (Blinkendes Licht)

### 10.1 Konzept

Jeder Landmark-Renderer erhält ein kleines blinkendes Kugel-Mesh, dessen
Farbe dem Worst-of-Level entspricht. Das Blinken wird über ein ShaderMaterial
(ähnlich `LASER_MAT`) mit `uTime`-Uniform realisiert.

### 10.2 `landmarkUtils.ts` – neue Hilfsfunktionen

```typescript
/** Erstellt eine kleine blinkende Statusleuchte. */
export function statusLight(level: QualityLevel): THREE.Mesh {
  const color = new THREE.Color(QUALITY_LEVEL_COLOR[level]);
  const geo   = new THREE.SphereGeometry(0.07, 8, 8);
  const mat   = new THREE.ShaderMaterial({
    uniforms: {
      uTime:  { value: 0.0 },
      uColor: { value: color },
      uOn:    { value: level !== 'NONE' ? 1.0 : 0.0 },
    },
    vertexShader: STATUS_VERT,
    fragmentShader: STATUS_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  mat.onBeforeRender = () => { mat.uniforms.uTime.value = performance.now() / 1000; };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0.3, 1.0, 0.0);   // rechts oben am Modell
  return mesh;
}
```

Shader-Snippet (`STATUS_FRAG`):
```glsl
uniform float uTime;
uniform vec3  uColor;
uniform float uOn;
void main() {
  // Blink-Frequenz: 1 Hz für WARNING, 2 Hz für ERROR, kein Blinken für OK/NONE
  float blink = uOn > 0.5 ? 0.5 + 0.5 * sin(uTime * 6.28 * 1.5) : 0.0;
  gl_FragColor = vec4(uColor * blink, blink);
}
```

- `OK`: kein Blinken, dauerhaft grün leuchtend (`sin`-Faktor entfällt).
- `WARNING`: langsames Blinken (1 Hz).
- `ERROR`: schnelles Blinken (2 Hz, Frequenzfaktor `3.0` statt `1.5`).
- `NONE`: Licht aus.

### 10.3 Integration in Renderer

Jeder Renderer ruft am Ende von `build()` `statusLight(worstLevel)` auf und
fügt das Mesh zur Gruppe hinzu. Das Level wird als neuer optionaler Parameter
übergeben:

```typescript
build(landmark: Landmark, elevation: number, tintColor: THREE.Color,
      adjacentWalls?: WallAdjacency[], worstLevel?: QualityLevel): THREE.Group
```

`useThreeScene.ts` berechnet `worstLevel` pro Landmark aus dem Store und
übergibt es beim Neuaufbau der Landmark-Gruppe.

### 10.4 Aktualisierung bei State-Änderungen

Wenn ein WS-Update eintrifft (`updateMap`), werden betroffene Landmark-Gruppen
in `useThreeScene.ts` neu gebaut (bestehende Logik). Da `worstLevel` dabei neu
berechnet wird, aktualisiert sich das Licht automatisch.

---

## 11. Datenfluß-Übersicht

```
Nutzer setzt Metric-Wert für Landmark
        │
        ▼
PUT /api/maps/{id}/landmarks/{lId}/metrics/{mId}
        │
        ▼
SetLandmarkMetricUseCase → Landmark.metrics aktualisiert
        │
        ▼
EclipseStore persistiert MapState
        │
        ▼
WebSocket-Broadcast → alle Clients erhalten neuen MapState
        │
        ├─► mapStore.updateMap()
        │         │
        │         ├─► LandmarkPanel zeigt neue Metric-Zeile (farbig)
        │         └─► Worst-of-Badge aktualisiert sich
        │
        └─► useThreeScene rebuild landmark group
                  └─► statusLight(newWorstLevel) blinkt in neuer Farbe
```

---

## 12. Nicht im Scope (mögliche spätere Erweiterungen)

- Globale Metric-Übersichts-Seite mit Aggregation über alle Landmarks.
- Schwellenwert-basierte automatische Level-Berechnung (z.B. `value > 5 % → ERROR`).
- Metrik-Kategorien / Tags.
- Export der Metrikdaten als CSV / JSON.

