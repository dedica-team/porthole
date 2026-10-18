# Plan: Map Name & Description

## Ziel

Maps sollen einen **Namen** und eine **Beschreibung** erhalten, die beim Klick auf die Map-ID in der Navbar inline bearbeitet werden können.

---

## 1. Backend – Domain-Modell

### 1.1 `MapState.kt`

- Zwei neue optionale Felder ergänzen:
  ```kotlin
  val name: String? = null,
  val description: String? = null,
  ```
- EclipseStore speichert Kotlin-`data class`-Felder by name → bestehende persistierte Objekte erhalten `null` für die neuen Felder (rückwärtskompatibel, keine Migration nötig).

---

## 2. Backend – Anwendungsschicht

### 2.1 Neuer Use-Case `EditMapUseCase.kt`

```
application/EditMapUseCase.kt
```

```kotlin
fun execute(mapId: UUID, username: String, name: String?, description: String?): MapState
```

Logik:
- Map per `mapStatePort.findById(mapId)` laden.
- Prüfen, dass der aufrufende User ein Collaborator der Map ist.
- Neuen `name` trimmen; leere Strings werden als `null` gespeichert.
- `description` trimmen; leere Strings werden als `null` gespeichert.
- Geänderte Map via `mapStatePort.save(state.copy(...))` speichern.
- Über `broadcastPort.send(mapId, state)` an alle Collaboratoren senden.
- Geänderte `MapState` zurückgeben.

---

## 3. Backend – Web-Adapter

### 3.1 Neues DTO `EditMapRequest.kt`

```
adapter/in/web/dto/EditMapRequest.kt
```

```kotlin
data class EditMapRequest(
    val name: String?,
    val description: String?,
)
```

### 3.2 `MapController.kt` – neuer Endpunkt

```http
PATCH /api/sessions/{id}
```

- Request Body: `EditMapRequest`
- Authentifizierung: ` UserDetails`
- Delegiert an `EditMapUseCase.execute(...)`
- Gibt `200 OK` mit dem vollständigen `MapState` zurück (konsistent mit anderen Endpunkten).

---

## 4. Frontend – Typen

### 4.1 `types/map.ts`

- `MapState`-Interface um optionale Felder erweitern:
  ```ts
  name?: string;
  description?: string;
  ```

---

## 5. Frontend – API

### 5.1 `api/mapApi.ts`

Neue Funktion `editMap`:

```ts
export async function editMap(
  id: string,
  name?: string,
  description?: string,
): Promise<MapState>
```

Sendet `PATCH /api/sessions/{id}` mit `{ name: name ?? null, description: description ?? null }`.

---

## 6. Frontend – Store

### 6.1 `store/mapStore.ts`

Die vorhandene `updateMap`-Aktion übernimmt bereits alle Felder des `MapState` – keine Änderung am Store nötig.

Optional: eigene Action `updateMapMeta` für optimistische Updates:

```ts
updateMapMeta: (mapId: UUID, name: string | undefined, description: string | undefined) => void
```

Setzt `currentMap.name` und `currentMap.description` sofort lokal, bevor die Server-Antwort eintrifft.

---

## 7. Frontend – Navbar-Interaktion

### 7.1 Neuer Dialog/Popover in `Navbar.tsx`

Der bestehende Map-ID-Bereich in der Navbar:

```tsx
<div className="flex items-center gap-1.5">
  <Map className="h-3.5 w-3.5 text-muted-foreground" />
  <span className="text-xs text-muted-foreground font-mono">
    #{currentMap.id.slice(0, 8)}
  </span>
</div>
```

wird zu einem **klickbaren Button**, der einen **Popover** (shadcn/ui `Popover` + `PopoverContent`) öffnet. Der Popover enthält:

| Element | Details |
|---|---|
| Map-Name | Inline-`Input` (shadcn `Input`), Placeholder `"Unbenannte Karte"` |
| Beschreibung | `Textarea` (shadcn `Textarea`), Placeholder `"Beschreibung…"` |
| Speicher-Button | `Button` „Speichern", ruft `editMap()` auf |
| Abbrechen | `Button` „Abbrechen" oder Klick außerhalb (automatisch durch `Popover`) |
| Map-ID | Read-only Anzeige + Copy-to-Clipboard Icon-Button |

UX-Details:
- Beim Öffnen werden die aktuellen Werte aus `currentMap.name` / `currentMap.description` als Startzustand in lokale State-Variablen übernommen.
- Änderungen werden erst beim Klick auf „Speichern" an den Server gesendet.
- Fehler werden als kleiner roter Hinweistext unter dem Formular angezeigt.
- Erfolg schließt den Popover.

### 7.2 Map-Name in der Navbar anzeigen

Wenn `currentMap.name` gesetzt ist, wird er neben der verkürzten ID angezeigt:

```
🗺 Meine erste Karte  #a1b2c3d4  ✎
```

Falls kein Name gesetzt ist, bleibt nur die ID sichtbar (wie bisher).

---

## 8. Frontend – LobbyPage

- Karten-Kacheln in der LobbyPage zeigen `map.name ?? "Unbenannte Karte"` als Titel an (aktuell wird gar kein Titel angezeigt).
- Beschreibung optional einblenden, wenn vorhanden.

---

## Zusammenfassung der Änderungen

| Schicht | Datei(en) | Art |
|---|---|---|
| Domain | `MapState.kt` | Erweitern |
| Anwendung | `EditMapUseCase.kt` | Neu |
| Web-Adapter | `EditMapRequest.kt` | Neu |
| Web-Adapter | `MapController.kt` | Erweitern |
| Frontend Typen | `types/map.ts` | Erweitern |
| Frontend API | `api/mapApi.ts` | Erweitern |
| Frontend Store | `store/mapStore.ts` | Optional: `updateMapMeta` hinzufügen |
| Frontend UI | `Navbar.tsx` | Erweitern (Popover) |
| Frontend UI | `LobbyPage.tsx` | Erweitern (Name in Kacheln) |

