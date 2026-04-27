# Plan: Connection-Typen, Name und Beschreibung

> Erstellt: 2026-03-12
> Status: ✅ vollständig implementiert

## Konzept

Connections erhalten drei neue optionale bzw. typisierte Attribute:

| Attribut      | Typ              | Pflicht | Default |
|---------------|------------------|---------|---------|
| `type`        | `ConnectionType` | ja      | `PIPE`  |
| `name`        | `String?`        | nein    | `null`  |
| `description` | `String?`        | nein    | `null`  |

### Connection-Typen

| Enum-Wert   | Bezeichnung     | Visuelle Darstellung                                     |
|-------------|-----------------|----------------------------------------------------------|
| `PIPE`      | Rohrleitung     | Tube-Geometrie (bisheriges Aussehen), Farbe: blau-weiß  |
| `TELEGRAPH` | Telegrafenleitung | Dünner Draht + vertikale Pole an Stützpunkten entlang des Pfads, Farbe: braun/kupfer |
| `STREET`    | Straße          | Breites, flaches Band entlang des Pfads, Farbe: grau-beige |

---

## Server

### 1. `domain/ConnectionType.kt` *(neu)*

```kotlin
package team.dedica.porthole.domain

enum class ConnectionType {
    PIPE,
    TELEGRAPH,
    STREET,
}
```

### 2. `domain/Connection.kt` – erweitern

```kotlin
data class Connection(
    val id: String,
    val fromTowerId: String,
    val toTowerId: String,
    val path: List<HexCoordinate>,
    val type: ConnectionType = ConnectionType.PIPE,
    val name: String? = null,
    val description: String? = null,
)
```

### 3. `adapter/in/web/MapController.kt` – Request-DTOs erweitern

`CreateConnectionRequest` erhält die neuen Felder:

```kotlin
data class CreateConnectionRequest(
    val fromTowerId: String,
    val toTowerId: String,
    val type: String = "PIPE",
    val name: String? = null,
    val description: String? = null,
)
```

Zusätzlich ein neues DTO für `EditConnectionRequest`:

```kotlin
data class EditConnectionRequest(
    val type: String? = null,
    val name: String? = null,
    val description: String? = null,
    val clearName: Boolean = false,
    val clearDescription: Boolean = false,
)
```

Der `POST /{id}/connections`-Handler in `MapController` leitet `type`, `name` und `description` an den UseCase weiter.

Ein neuer Endpunkt ermöglicht nachträgliches Bearbeiten:

```
PATCH /api/maps/{id}/connections/{connectionId}
Body: EditConnectionRequest
```

### 4. `application/CreateConnectionUseCase.kt` – Signatur erweitern

```kotlin
fun execute(
    mapId: String,
    fromLandmarkId: String,
    toLandmarkId: String,
    type: ConnectionType = ConnectionType.PIPE,
    name: String? = null,
    description: String? = null,
): MapState
```

Die `Connection`-Instanz wird mit den neuen Feldern erstellt.

Validierung:
- `type` muss ein gültiger `ConnectionType`-Wert sein (bereits im Controller per `valueOf` geprüft, Fehler → 400)
- `name` darf nicht leer sein, wenn angegeben (Whitespace-Trim + Blank-Check)
- `description` darf nicht leer sein, wenn angegeben

### 5. `application/EditConnectionUseCase.kt` *(neu)*

```kotlin
@Component
class EditConnectionUseCase(
    private val mapStatePort: MapStatePort,
    private val broadcastPort: BroadcastPort,
) {
    fun execute(
        mapId: String,
        connectionId: String,
        type: ConnectionType? = null,
        name: String? = null,
        description: String? = null,
        clearName: Boolean = false,
        clearDescription: Boolean = false,
    ): MapState {
        val state = mapStatePort.findById(mapId)
            ?: throw NoSuchElementException("Map $mapId not found")
        val existing = state.connections[connectionId]
            ?: throw NoSuchElementException("Connection $connectionId not found")

        val updated = existing.copy(
            type        = type ?: existing.type,
            name        = when {
                clearName -> null
                name != null -> name.trim().takeIf { it.isNotBlank() }
                    ?: throw IllegalArgumentException("name must not be blank")
                else -> existing.name
            },
            description = when {
                clearDescription -> null
                description != null -> description.trim().takeIf { it.isNotBlank() }
                    ?: throw IllegalArgumentException("description must not be blank")
                else -> existing.description
            },
        )
        state.connections[connectionId] = updated
        mapStatePort.save(state)
        broadcastPort.send(mapId, state)
        return state
    }
}
```

### 6. Tests

#### `domain/ConnectionTypeTest.kt` *(neu)*
- Alle drei Enum-Werte vorhanden: `PIPE`, `TELEGRAPH`, `STREET`
- Default-Wert von `Connection.type` ist `PIPE`
- `Connection` mit explizit gesetztem `type = TELEGRAPH` behält den Wert

#### `application/CreateConnectionUseCaseTest.kt` – erweitern
- Erfolgsfall ohne optionale Felder: `type == PIPE`, `name == null`, `description == null`
- Erfolgsfall mit `type = STREET`, `name = "Main Road"`, `description = "Connects north and south"`
- Fehler: unbekannter Type-String → 400 (im Controller geprüft, UseCase-Test mit Enum-Wert)
- Fehler: `name` ist Leerzeichen → `IllegalArgumentException`
- Fehler: `description` ist Leerzeichen → `IllegalArgumentException`

#### `application/EditConnectionUseCaseTest.kt` *(neu)*
- Erfolgsfall: Typ ändern von `PIPE` auf `TELEGRAPH`
- Erfolgsfall: Name setzen
- Erfolgsfall: Name löschen via `clearName = true`
- Erfolgsfall: Beschreibung setzen und wieder löschen
- Fehler: Connection-ID existiert nicht → `NoSuchElementException`
- Fehler: Map-ID existiert nicht → `NoSuchElementException`

---

## Client

### 1. `types/map.ts` – Connection-Interface und Typ erweitern

```typescript
export type ConnectionType = 'PIPE' | 'TELEGRAPH' | 'STREET';

export const CONNECTION_TYPE_LABELS: Record<ConnectionType, string> = {
  PIPE:      '🔧 Pipe',
  TELEGRAPH: '📡 Telegraph',
  STREET:    '🛣️ Street',
};

export const ALL_CONNECTION_TYPES: ConnectionType[] = Object.keys(CONNECTION_TYPE_LABELS) as ConnectionType[];

export interface Connection {
  id: string;
  fromTowerId: string;
  toTowerId: string;
  path: HexCoordinate[];
  type: ConnectionType;       // default: 'PIPE'
  name?: string;
  description?: string;
}
```

### 2. `api/mapApi.ts` – Funktionen erweitern

`createConnection` erhält optionale Parameter:

```typescript
export async function createConnection(
  mapId: string,
  fromTowerId: string,
  toTowerId: string,
  type: ConnectionType = 'PIPE',
  name?: string,
  description?: string,
): Promise<MapState>
```

Neue Funktion `editConnection`:

```typescript
export async function editConnection(
  mapId: string,
  connectionId: string,
  type?: ConnectionType,
  name?: string,
  description?: string,
  clearName?: boolean,
  clearDescription?: boolean,
): Promise<MapState>
// PATCH /api/maps/{mapId}/connections/{connectionId}
```

### 3. `components/HexGrid/HexGrid.tsx` – Connection-Rendering nach Typ aufsplitten

Der bestehende `useEffect` für Connection-Linien wird in eine Hilfsfunktion `buildConnectionMesh(conn, tiles)` ausgelagert, die je nach `conn.type` unterschiedliche Three.js-Geometrien erstellt:

#### `PIPE` (unverändertes Verhalten)
- `THREE.TubeGeometry` mit Radius `0.04`, Segmente `6`
- Farbe: `0x7dd3fc` (blau-weiß, bisheriges Aussehen)

#### `TELEGRAPH`
- Draht: `THREE.TubeGeometry` mit Radius `0.015`, erhöht `+0.05` über Tile-Oberfläche
- Farbe Draht: `0xb45309` (kupferbraun)
- Pole: an jedem 3. Pfadpunkt (und Endpunkten) ein `THREE.CylinderGeometry` (Radius `0.04`, Höhe `0.4`) in `0x92400e`
- Alle Meshes werden als Gruppe unter derselben Connection-ID im `connectionMeshMapRef` gespeichert (Map speichert `THREE.Group`)

#### `STREET`
- `THREE.PlaneGeometry`-Segmente entlang des Pfads als breites Band (Breite `0.35`)
- Pfad wird in Liniensegmente unterteilt; für jedes Segment wird ein flaches, leicht erhöhtes (`+0.01`) Quad erstellt und passend rotiert/positioniert
- Alternativ: `THREE.TubeGeometry` mit sehr großem Radius `0.2` und flacher Darstellung durch `flatShading`
- Farbe: `0xd4c5a0` (sandbeige)
- Material: `MeshLambertMaterial` ohne Emissive

Die Connection-ID wird in `connectionMeshMapRef` auf ein `THREE.Group`-Objekt gemappt statt auf ein einzelnes Mesh, um alle Teil-Objekte eines Connection-Typs gemeinsam entfernen zu können.

### 4. `components/Sidebar/Sidebar.tsx` – Connection-Erstellung mit Typ

Im bestehenden „Create Connection"-Flow (Landmark-Panel) wird vor dem Auslösen von `onStartConnection` ein Typ-Selector angezeigt:

- `<Select>` mit den drei `ConnectionType`-Optionen (Label aus `CONNECTION_TYPE_LABELS`)
- Optional: Textfeld für `name`
- Optional: Textfeld für `description`
- Der gewählte Typ (und optionale Metadaten) werden als State gehalten und beim Klick auf „Start Connection" an `onStartConnection` übergeben

`onStartConnection`-Prop-Signatur ändert sich:

```typescript
onStartConnection: (type: ConnectionType, name?: string, description?: string) => void;
```

### 5. `pages/MapPage/MapPage.tsx` – neue Prop-Signatur weiterreichen

```typescript
const handleStartConnection = (type: ConnectionType, name?: string, description?: string) => {
  if (!selectedLandmark) return;
  setConnectingFromLandmark(selectedLandmark.id);
  setPendingConnectionMeta({ type, name, description });  // neuer Store-Slice
  setSelectedLandmark(null);
  setSidebarPanel('idle');
};
```

Im `handleTileClick`-Branch für `connectingFromLandmarkId`:

```typescript
withAction(() =>
  createConnection(currentMap.id, connectingFromLandmarkId, landmark.id,
    pendingConnectionMeta.type,
    pendingConnectionMeta.name,
    pendingConnectionMeta.description,
  )
);
```

Nach dem Erstellen: `setPendingConnectionMeta({ type: 'PIPE' })` zurücksetzen.

### 6. `store/mapStore.ts` – neuer Slice für Connection-Metadaten

```typescript
pendingConnectionMeta: { type: ConnectionType; name?: string; description?: string };
setPendingConnectionMeta: (meta: { type: ConnectionType; name?: string; description?: string }) => void;
```

Initial: `{ type: 'PIPE' }`

### 7. Connection-Info-Panel im Sidebar *(optional, Phase 2)*

Wenn eine Connection angeklickt wird (Klick auf Tube/Band/Draht in der 3D-Ansicht), öffnet sich ein Sidebar-Panel `'connection'` mit:
- Anzeige von Typ, Name, Beschreibung
- Edit-Formular (Typ-Selector, Name-Feld, Beschreibungs-Feld)
- „Save"-Button ruft `editConnection` auf

Dieses Panel wird als optionaler zweiter Schritt implementiert und ist **nicht** Bestandteil des MVP.

---

## Tests (Client)

### `test/HexGrid.test.tsx` *(neu oder erweitern)*
- Rendert PIPE-Connection als Tube mit blauer Farbe
- Rendert TELEGRAPH-Connection mit Draht und Poles
- Rendert STREET-Connection als breites Band
- Bei Connection-Update werden alte Meshes entfernt und neue erstellt

### `test/MapPage.test.tsx` – erweitern
- `handleStartConnection` übergibt Typ `TELEGRAPH` korrekt an `createConnection`
- Nach erfolgreicher Connection wird `pendingConnectionMeta` zurückgesetzt

---

## Datei-Übersicht

| Datei | Änderung |
|---|---|
| `server/.../domain/ConnectionType.kt` | ✅ implementiert |
| `server/.../domain/Connection.kt` | ✅ erweitert |
| `server/.../adapter/in/web/MapController.kt` | ✅ erweitert |
| `server/.../application/CreateConnectionUseCase.kt` | ✅ erweitert |
| `server/.../application/EditConnectionUseCase.kt` | ✅ implementiert |
| `server/.../domain/ConnectionTypeTest.kt` | ✅ implementiert |
| `server/.../application/CreateConnectionUseCaseTest.kt` | ✅ erweitert |
| `server/.../application/EditConnectionUseCaseTest.kt` | ✅ implementiert |
| `client/src/types/map.ts` | ✅ erweitert |
| `client/src/api/mapApi.ts` | ✅ erweitert |
| `client/src/store/mapStore.ts` | ✅ erweitert |
| `client/src/components/HexGrid/HexGrid.tsx` | ✅ erweitert |
| `client/src/components/Sidebar/Sidebar.tsx` | ✅ erweitert |
| `client/src/pages/MapPage/MapPage.tsx` | ✅ erweitert |
| `client/src/test/MapPage.test.tsx` | ✅ angepasst |

