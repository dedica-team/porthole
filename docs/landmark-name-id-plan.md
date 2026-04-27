# Plan: Landmark-Namen, eindeutige IDs und Tower-Löschung

## Ziel

- Jedes Landmark (Tower) erhält einen **menschenlesbaren Namen** (z. B. „Iron Keep").
- Die **ID** wird automatisch aus dem Namen generiert: lowercase ASCII, keine Leerzeichen, nur `a-z`, `0-9`, `-` (entspricht Dateinamen-Konventionen).
- Der Name wird in der **3D-Ansicht über dem Tower** angezeigt.
- Der Name muss beim Platzieren eingegeben werden; ohne gültigen Namen ist das Platzieren nicht möglich.
- Es gibt einen **„Remove"-Button** im TowerPanel, der den Tower und alle zugehörigen Connections löscht.

---

## Teil 1 – Backend (Kotlin/Spring)

### 1.1 Domain: `Tower.kt`

Feld `name: String` hinzufügen.

```kotlin
data class Tower(
    val id: String,          // slug, z. B. "iron-keep"
    val name: String,        // Anzeigename, z. B. "Iron Keep"
    val ownerId: String,
    val coordinate: HexCoordinate,
    val level: TowerLevel = TowerLevel.LEVEL_1
)
```

**ID-Generierung** erfolgt im Use Case (nicht im Domain-Objekt), nach der Regel:
```
id = name.trim().lowercase()
         .replace(Regex("[^a-z0-9]+"), "-")
         .trim('-')
```

### 1.2 Validierung (Domain oder Use Case)

- ID muss eindeutig innerhalb des `MapState` sein: `require(state.towers[id] == null) { "Landmark-ID '$id' bereits vergeben" }`.
- `name` darf nicht leer sein.
- `id` muss nach Normalisierung mindestens 1 Zeichen lang sein.

### 1.3 `PlaceTowerUseCase.kt`

- Eingabe erweitern: `name: String`.
- ID aus Name ableiten (Hilfsfunktion `toSlug(name: String): String`).
- Tower-ID ist jetzt der Slug statt einer UUID.

```kotlin
fun execute(mapId: String, username: String, coordinate: HexCoordinate, name: String): MapState {
    ...
    val id = toSlug(name)
    require(id.isNotEmpty()) { "Landmark-Name ergibt keine gültige ID" }
    require(state.towers[id] == null) { "Landmark-ID '$id' bereits vergeben" }
    val tower = Tower(id = id, name = name, ownerId = collaboratorId, coordinate = coordinate)
    ...
}

private fun toSlug(name: String): String =
    name.trim().lowercase()
        .replace(Regex("[^a-z0-9]+"), "-")
        .trimStart('-').trimEnd('-')
```

### 1.4 `MapController.kt`

- `PlaceTowerRequest` um `name: String` erweitern.
- Den `name`-Parameter an `PlaceTowerUseCase.execute` weitergeben.
- Neuen Endpunkt `DELETE /api/maps/{id}/towers/{towerId}` hinzufügen.

```kotlin
data class PlaceTowerRequest(val q: Int, val r: Int, val name: String)

@DeleteMapping("/{id}/towers/{towerId}")
fun removeTower(
    @PathVariable id: String,
    @PathVariable towerId: String,
    @AuthenticationPrincipal user: UserDetails,
) = ResponseEntity.ok(removeTowerUseCase.execute(id, user.username, towerId))
```

### 1.5 Neuer Use Case: `RemoveTowerUseCase.kt`

```kotlin
@Component
class RemoveTowerUseCase(
    private val mapStatePort: MapStatePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(mapId: String, username: String, towerId: String): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val user = userPort.findByUsername(username)
            ?: throw NoSuchElementException("User $username not found")
        val tower = state.towers[towerId]
            ?: throw NoSuchElementException("Tower $towerId not found")
        require(tower.ownerId == user.id) { "Nur der Eigentümer darf dieses Landmark löschen" }

        // Tower und alle zugehörigen Connections entfernen
        state.towers.remove(towerId)
        val toRemove = state.connections.values
            .filter { it.fromTowerId == towerId || it.toTowerId == towerId }
            .map { it.id }
        toRemove.forEach { state.connections.remove(it) }

        // Tile-Owner zurücksetzen
        state.map.setOwner(tower.coordinate, null)

        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
```

### 1.6 Tests (Backend)

- `PlaceTowerUseCaseTest`: Testfall für `name`-Parameter, Slug-Generierung, Duplikat-ID.
- Neuer `RemoveTowerUseCaseTest`: Tower + Connections werden entfernt, nur Eigentümer darf löschen.
- `MapControllerTest` (Integration): DELETE-Endpunkt prüfen.

---

## Teil 2 – Frontend (React/TypeScript)

### 2.1 `types/map.ts`

`name`-Feld im `Tower`-Interface ergänzen:

```typescript
export interface Tower {
  id: string;
  name: string;           // NEU
  ownerId: string;
  coordinate: HexCoordinate;
  level: TowerLevel;
}
```

### 2.2 `api/mapApi.ts`

- `placeTower` um `name: string` erweitern:

```typescript
export async function placeTower(mapId: string, q: number, r: number, name: string): Promise<MapState>
// body: JSON.stringify({ q, r, name })
```

- Neue Funktion `removeTower`:

```typescript
export async function removeTower(mapId: string, towerId: string): Promise<MapState> {
  const res = await fetch(`${BASE_URL}/maps/${mapId}/towers/${towerId}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return handleResponse<MapState>(res);
}
```

### 2.3 Name-Eingabe-Dialog: `PlaceTowerDialog.tsx` (neue Komponente)

Ein kleines Modal/Inline-Formular in der Sidebar (`TilePanel`), das erscheint, wenn der Nutzer auf „Landmark platzieren" klickt:

- `<Input>` für den Namen.
- Live-Vorschau der generierten ID darunter (hellgrau, Monospace): `id: iron-keep`.
- ID-Generierungslogik (identisch zu Backend) als Hilfsfunktion `toSlug` in `utils/slugUtils.ts`.
- „Bestätigen"-Button ist disabled, solange Name leer oder Slug leer ist.
- Slug-Duplikat-Check gegen `currentMap.towers` (client-seitige Vorabprüfung).
- Bei Submit: `onPlaceTower(q, r, name)` aufrufen.

```typescript
// utils/slugUtils.ts
export function toSlug(name: string): string {
  return name.trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

### 2.4 `TilePanel.tsx`

- Statt direktem `onPlaceTower`-Aufruf: Formular einblenden (State `showNameForm: boolean`).
- Name und berechneter Slug als lokaler State.
- Nach Absenden: `onPlaceTower(q, r, name)` aufrufen.

Ablauf:
1. Nutzer klickt „Landmark platzieren" → Name-Eingabefeld erscheint.
2. Nutzer tippt Name → Slug-Vorschau aktualisiert sich.
3. Nutzer klickt „Bestätigen" → Tower wird platziert.
4. Bei Fehler (Duplikat-ID) → Fehlermeldung im Feld.

### 2.5 `MapPage.tsx`

- `handlePlaceTower(q, r)` → `handlePlaceTower(q, r, name: string)`.
- `placeTower(currentMap.id, q, r, name)` aufrufen.
- `handleRemoveTower(towerId: string)` hinzufügen:

```typescript
const handleRemoveTower = (towerId: string) => {
  withAction(() => removeTower(currentMap.id, towerId));
  setSelectedTower(null);
  setSidebarPanel('idle');
};
```

- `handleRemoveTower` an `<Sidebar>` und dann an `<TowerPanel>` weiterreichen.

### 2.6 `TowerPanel.tsx`

- `onRemoveTower: () => void` als neue Prop.
- Button „Remove Landmark" (mit `Trash2`-Icon aus lucide-react) im Owner-Bereich:

```tsx
{isOwner && (
  <Button
    size="sm"
    variant="destructive"
    className="w-full gap-2 h-9 py-2"
    disabled={loading}
    onClick={onRemoveTower}
  >
    <Trash2 className="h-3.5 w-3.5" />
    Remove Landmark
  </Button>
)}
```

- Tower-Name statt ID im Header anzeigen: `{selectedTower.name}` statt `#{selectedTower.id.slice(0, 8)}`.

### 2.7 `HexGrid.tsx` – Tower-Name über dem 3D-Modell

Für jeden Tower einen **CSS2DObject** (Three.js `CSS2DRenderer`) oder ein **Sprite mit Canvas-Texture** hinzufügen, das den `tower.name` über dem Tower anzeigt.

**Empfohlener Ansatz: Canvas-Texture-Sprite** (kein zusätzlicher Renderer nötig):

```typescript
// Im Tower-useEffect, nach dem Erstellen des group:
const canvas = document.createElement('canvas');
canvas.width = 256; canvas.height = 48;
const ctx = canvas.getContext('2d')!;
ctx.fillStyle = 'rgba(0,0,0,0.55)';
ctx.roundRect(4, 8, canvas.width - 8, canvas.height - 12, 6);
ctx.fill();
ctx.fillStyle = '#f0f0f0';
ctx.font = 'bold 22px sans-serif';
ctx.textAlign = 'center';
ctx.fillText(tower.name, 128, 34);
const texture = new THREE.CanvasTexture(canvas);
const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
const sprite = new THREE.Sprite(spriteMat);
sprite.scale.set(3, 0.6, 1);
sprite.position.set(0, towerH / 2 + 0.8, 0);
group.add(sprite);
```

Die Sprites werden zusammen mit dem Tower-Mesh verwaltet (gleicher `useEffect`, gleiche Cleanup-Logik).

### 2.8 `Sidebar.tsx`

- Neue Prop `onRemoveTower` annehmen und an `TowerPanel` weiterreichen.

---

## Teil 3 – Datenpersistenz

Die bestehende EclipseStore-Persistenz serialisiert `MapState` automatisch. Da `Tower` um `name: String` erweitert wird, muss die **Schemamigration** berücksichtigt werden:

- Vorhandene Tower im Store haben kein `name`-Feld → beim Deserialisieren würde eine Exception entstehen.
- **Lösung**: `name` im Domain-Objekt mit Defaultwert versehen:
  ```kotlin
  val name: String = id  // Fallback: ID als Name für alte Daten
  ```
- Alternativ: bestehende Daten löschen (`data/eclipse-store/` leeren) – da es sich um Entwicklungsdaten handelt, ist das der einfachste Weg.

---

## Implementierungsreihenfolge

1. **Backend**
   - [ ] `Tower.kt`: `name`-Feld hinzufügen (mit Default-Fallback)
   - [ ] `PlaceTowerUseCase.kt`: `name`-Parameter + `toSlug`-Hilfsfunktion + Duplikat-Prüfung
   - [ ] `RemoveTowerUseCase.kt`: neuer Use Case
   - [ ] `MapController.kt`: `PlaceTowerRequest` + DELETE-Endpunkt
   - [ ] Backend-Tests anpassen/ergänzen

2. **Frontend**
   - [ ] `types/map.ts`: `name`-Feld
   - [ ] `utils/slugUtils.ts`: `toSlug`-Funktion
   - [ ] `api/mapApi.ts`: `placeTower` + `removeTower`
   - [ ] `TilePanel.tsx`: Name-Eingabeformular
   - [ ] `MapPage.tsx`: Handler anpassen
   - [ ] `Sidebar.tsx`: Props erweitern
   - [ ] `TowerPanel.tsx`: Name anzeigen + Remove-Button
   - [ ] `HexGrid.tsx`: Canvas-Sprite-Labels über Towers

3. **Tests**
   - [ ] Frontend-Unittests für `toSlug`
   - [ ] Frontend-Komponenten-Tests für `TilePanel` (Namenseingabe)
   - [ ] Backend Use-Case-Tests

---

## Offene Fragen / Designentscheidungen

| Frage | Empfehlung |
|---|---|
| Darf ein Name geändert werden (Rename)? | Nicht im ersten Schritt; ID bleibt dann konsistent. |
| Darf nur der Eigentümer löschen? | Ja (serverseitig erzwingen). |
| Sollen Connections beim Löschen automatisch entfernt werden? | Ja (serverseitig im Use Case). |
| Sollen Namen global oder nur pro Map eindeutig sein? | Pro Map eindeutig (da ID als Map-Key genutzt wird). |
| Maximale Namenslänge? | 40 Zeichen empfohlen (für Label-Darstellung). |

