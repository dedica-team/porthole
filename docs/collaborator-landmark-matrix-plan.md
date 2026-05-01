# Plan: Collaborator × Landmark Matrix

Eine neue vollständige Ansicht (analog zu `MetricsView`), in der **Zeilen = Landmarks** und **Spalten = Kollaboratoren** sind. Jede Zelle hält einen von vier Werten: `HIGH / MEDIUM / LOW / NONE`. Die Matrix hat einen frei wählbaren Namen.

> **Scope:** Pro Map gibt es genau **eine** Matrix. Sie wird beim ersten Zugriff automatisch angelegt (lazy init) – es gibt keine UI-Buttons zum Erstellen oder Löschen der Matrix.

---

## Schritt 1 – Backend: Domain-Modell erweitern

Neue Datei `domain/CollaboratorMatrix.kt`:

```kotlin
enum class MatrixLevel { NONE, LOW, MEDIUM, HIGH }

data class CollaboratorMatrixEntry(val level: MatrixLevel = MatrixLevel.NONE)

data class CollaboratorMatrix(
    val name: String = "Collaborator Matrix",
    // outer key = landmarkId, inner key = collaboratorId
    val entries: MutableMap<String, MutableMap<String, CollaboratorMatrixEntry>> = mutableMapOf(),
)
```

`domain/MapState.kt` bekommt ein neues Feld:

```kotlin
var collaboratorMatrix: CollaboratorMatrix = CollaboratorMatrix()
```

**Rückwärtskompatibilität:** Mit Default-Wert deserialisieren vorhandene JSON-Dateien ohne Migration.

**Kaskadierendes Bereinigen:** Beim Entfernen eines Landmarks (`RemoveLandmarkUseCase`) dessen Einträge in der Matrix löschen.

---

## Schritt 2 – Backend: Use Cases

Nur noch drei Use Cases (kein Create/Remove der Matrix selbst):

| Datei | Signatur |
|---|---|
| `EditCollaboratorMatrixUseCase.kt` | `execute(mapId, username, name): MapState` |
| `SetMatrixEntryUseCase.kt` | `execute(mapId, username, landmarkId, collaboratorId, level): MapState` |
| `ClearMatrixEntryUseCase.kt` | `execute(mapId, username, landmarkId, collaboratorId): MapState` |

Jeder Use Case folgt dem gleichen Muster:
1. `mapStatePort.findById(mapId)` – Map laden
2. `requireCollaborator(mapState, username)` – Berechtigung prüfen
3. Mutation auf dem State
4. `mapStatePort.save(mapState)` – persistieren
5. `broadcastPort.send(mapId, mapState)` – WebSocket-Broadcast

---

## Schritt 3 – Backend: HTTP-Controller & DTOs

Neue DTOs in `dto/MapRequestDtos.kt`:

```kotlin
data class EditCollaboratorMatrixRequest(
    @field:Size(max = 200) val name: String?
)
data class SetMatrixEntryRequest(
    val level: String  // "NONE" | "LOW" | "MEDIUM" | "HIGH"
)
```

Neuer `CollaboratorMatrixController` mit Basis-Mapping `/api/maps/{id}/collaborator-matrix`:

| Methode | Pfad | Aktion |
|---|---|---|
| `PATCH` | `/` | Matrix umbenennen |
| `PUT` | `/landmarks/{lmId}/collaborators/{colId}` | Eintrag setzen |
| `DELETE` | `/landmarks/{lmId}/collaborators/{colId}` | Eintrag löschen |

---

## Schritt 4 – Frontend: Typen

Ergänzungen in `types/map.ts`:

```typescript
export type MatrixLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH';

export const MATRIX_LEVEL_ORDER: MatrixLevel[] = ['NONE', 'LOW', 'MEDIUM', 'HIGH'];

export const MATRIX_LEVEL_COLOR: Record<MatrixLevel, string> = {
  NONE:   'text-muted-foreground',
  LOW:    'text-red-400',
  MEDIUM: 'text-yellow-400',
  HIGH:   'text-green-400',
};

export const MATRIX_LEVEL_LABEL: Record<MatrixLevel, string> = {
  NONE:   'None',
  LOW:    'Low',
  MEDIUM: 'Medium',
  HIGH:   'High',
};

export interface CollaboratorMatrixEntry {
  level: MatrixLevel;
}

export interface CollaboratorMatrix {
  name: string;
  // landmarkId → collaboratorId → entry
  entries: Record<string, Record<string, CollaboratorMatrixEntry>>;
}
```

`MapState` bekommt:
```typescript
collaboratorMatrix?: CollaboratorMatrix;
```

---

## Schritt 5 – Frontend: API-Layer

In `api/mapApi.ts` drei neue Funktionen:

```typescript
editCollaboratorMatrix(mapId: UUID, name: string): Promise<void>
setMatrixEntry(mapId: UUID, landmarkId: string, collaboratorId: string, level: MatrixLevel): Promise<void>
clearMatrixEntry(mapId: UUID, landmarkId: string, collaboratorId: string): Promise<void>
```

---

## Schritt 6 – Frontend: `CollaboratorMatrixView`-Komponente

Neue Datei `components/CollaboratorMatrixView/CollaboratorMatrixView.tsx`, aufgebaut exakt wie `MetricsView.tsx`.

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│  [Matrix-Name ✏]                                           │  ← Header
├──────────────┬─────────┬──────────┬──────────┬─────────────┤
│ Landmark     │ Alice   │ Bob      │ Carol    │ …           │  ← Thead
├──────────────┼─────────┼──────────┼──────────┼─────────────┤
│ Group A      │         │          │          │             │  ← Gruppen-Trennzeile (Farbstreifen)
│  Landmark 1  │ ● HIGH  │ ● NONE   │ ● LOW    │             │
│  Landmark 2  │ ● NONE  │ ● MEDIUM │ ● NONE   │             │
├──────────────┼─────────┼──────────┼──────────┼─────────────┤
│ Group B      │         │          │          │             │
│  Landmark 3  │ ● LOW   │ ● HIGH   │ ● MEDIUM │             │
└──────────────┴─────────┴──────────┴──────────┴─────────────┘
```

### Sub-Komponenten

- **`MatrixNameEditDialog`** – Matrix umbenennen (nur Namensfeld + Save, kein Löschen, analog zu `MetricDefinitionEditDialog`).
- **`MatrixCellEditDialog`** – Öffnet sich beim Klick auf eine Zelle (nur für Kollaboratoren). Zeigt die vier `MatrixLevel`-Optionen als große, farbige Klick-Buttons an. Ein Klick auf eine Option setzt den Wert sofort (kein separater Save-Button nötig) und schließt den Dialog.

### `MatrixCellEditDialog` – Detail

```tsx
// Öffnet sich beim Klick auf eine Zelle. Zeigt vier Buttons, einer je Level.
// Klick auf eine Option → onSetEntry(..., level) → Dialog schließt sich.
<Dialog open={!!cellEdit} onOpenChange={(v) => { if (!v) onClose(); }}>
  <DialogContent className="max-w-xs p-0 overflow-hidden">
    <DialogHeader className="px-5 pt-5 pb-3">
      <DialogTitle className="text-sm">
        {collaboratorName}
        <span className="ml-2 text-[11px] font-normal text-muted-foreground">— {landmarkName}</span>
      </DialogTitle>
    </DialogHeader>
    <div className="flex flex-col gap-1 px-5 pb-5">
      {MATRIX_LEVEL_ORDER.slice().reverse().map((level) => (
        <button
          key={level}
          className={`w-full text-left px-3 py-2 rounded text-sm font-medium transition-colors
            ${currentLevel === level ? 'ring-1 ring-inset ring-current' : 'opacity-60 hover:opacity-100'}
            ${MATRIX_LEVEL_BADGE_CLASS[level]}`}
          onClick={() => { onSelect(level); onClose(); }}
        >
          {MATRIX_LEVEL_LABEL[level]}
          {currentLevel === level && <Check className="h-3.5 w-3.5 ml-auto inline float-right mt-0.5" />}
        </button>
      ))}
    </div>
  </DialogContent>
</Dialog>
```

`MATRIX_LEVEL_BADGE_CLASS` ist eine Hilfskonstante:
```typescript
export const MATRIX_LEVEL_BADGE_CLASS: Record<MatrixLevel, string> = {
  HIGH:   'bg-green-900 text-green-300',
  MEDIUM: 'bg-yellow-900 text-yellow-300',
  LOW:    'bg-red-900 text-red-300',
  NONE:   'bg-muted text-muted-foreground',
};
```

| Level  | Farbe    | Badge-Stil                     |
|--------|----------|-------------------------------|
| `HIGH`   | Grün   | `bg-green-900 text-green-300`  |
| `MEDIUM` | Gelb   | `bg-yellow-900 text-yellow-300`|
| `LOW`    | Rot    | `bg-red-900 text-red-300`      |
| `NONE`   | Grau   | `bg-muted text-muted-foreground`|

### Berechtigungen

- **Kollaboratoren** können Zellen klicken und Werte setzen.
- **Nicht-Kollaboratoren** sehen die Matrix nur lesend – kein Klick-Handler, analog zum `isCollaborator`-Guard in `MetricsView`.

---

## Schritt 7 – Frontend: State Management

In `store/mapStore.ts` die `SidebarPanel`-Union um `'matrix'` erweitern:

```typescript
export type SidebarPanel = … | 'matrix';
```

Kein zusätzlicher `selectedMatrixId`-State nötig (nur eine Matrix pro Map).

---

## Schritt 8 – Frontend: Einbinden in MapPage und Navigation

### `pages/MapPage/MapPage.tsx`

Drei neue `useCallback`-Handler (analog zu `handleCreateMetric`):

```typescript
const handleEditCollaboratorMatrix = useCallback(async (name) => { … }, [mapId]);
const handleSetMatrixEntry         = useCallback(async (lmId, colId, level) => { … }, [mapId]);
const handleClearMatrixEntry       = useCallback(async (lmId, colId) => { … }, [mapId]);
```

Im Render-Zweig:
```tsx
{sidebarPanel === 'matrix' && (
  <CollaboratorMatrixView
    isCollaborator={isCollaborator}
    onEditMatrix={handleEditCollaboratorMatrix}
    onSetEntry={handleSetMatrixEntry}
    onClearEntry={handleClearMatrixEntry}
  />
)}
```

### `components/Navbar/Navbar.tsx`

Analog zum bestehenden Metrics-Button (der `sidebarPanel` zwischen `'metrics'` und `'idle'` togglet) wird ein neuer Button für die Matrix ergänzt. Er steht direkt neben dem Metrics-Button in der Navbar-Zeile (beide sichtbar wenn `isOnMap && currentMap`):

```tsx
import { LayoutGrid } from 'lucide-react'; // oder ein passendes Icon

<Tooltip>
  <TooltipTrigger asChild>
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5 h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
      onClick={() => setSidebarPanel(sidebarPanel === 'matrix' ? 'idle' : 'matrix')}
    >
      <LayoutGrid className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">
        {sidebarPanel === 'matrix' ? 'View Map' : 'Matrix'}
      </span>
    </Button>
  </TooltipTrigger>
  <TooltipContent side="bottom" className="text-xs">
    {sidebarPanel === 'matrix' ? 'Back to map' : 'Collaborator matrix'}
  </TooltipContent>
</Tooltip>
```

Der Landscape-Editor-Button bleibt weiterhin nur sichtbar, wenn `sidebarPanel !== 'metrics'` – dieselbe Bedingung auf `!== 'matrix'` erweitern:

```tsx
{isCollaborator && sidebarPanel !== 'metrics' && sidebarPanel !== 'matrix' && ( … )}
```

---

## Schritt 9 – Tests

### Frontend (`test/CollaboratorMatrixView.test.tsx`, Vitest + Testing Library)

- Tabelle rendert korrekte Zeilen (Landmarks) und Spalten (Kollaboratoren)
- Zell-Klick öffnet Level-Dialog (nur für Kollaboratoren)
- Klick auf Level-Option ruft `onSetEntry` mit korrekten Argumenten auf und schließt Dialog
- Nicht-Kollaboratoren sehen Matrix ohne klickbare Zellen
- Fehler-Alert bei API-Fehler
- Matrix umbenennen via `MatrixNameEditDialog`

### Backend (`CollaboratorMatrixControllerTest.kt`, Kotlin/JUnit + MockMvc)

- `PATCH /` → 200, neuer Name gesetzt
- `PUT /landmarks/{lmId}/collaborators/{colId}` → 200, Level gesetzt
- `DELETE /landmarks/{lmId}/collaborators/{colId}` → 200, Eintrag entfernt
- Alle mutativen Endpoints → 403 für Nicht-Kollaborator
- Ungültige `level`-Werte → 400

---

## Weitere Überlegungen

### Persistenz / JSON-Rückwärtskompatibilität
Das Feld `collaboratorMatrix` in `MapState` mit einem Default-Wert initialisieren – vorhandene JSON-Dateien deserialisieren ohne Migration.

### Kaskadierendes Bereinigen
- Beim Löschen eines Landmarks dessen Einträge in der Matrix entfernen (`RemoveLandmarkUseCase` anpassen).
- Beim Entfernen eines Kollaborators (sofern Feature existiert) dessen Spalte in der Matrix bereinigen.

