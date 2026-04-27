# Plan: EclipseStore ersetzen durch JSON-Dateipersistenz

## Ausgangssituation

EclipseStore dient aktuell als einziger Persistenzmechanismus.
Er verwaltet zwei Aggregate:

| Aggregat | Port | Implementierung |
|---|---|---|
| `MapState` | `MapStatePort` | `EclipseStoreMapStateRepository` |
| `UserRecord` | `UserWritePort` | `EclipseStoreUserRepository` |

Beide Implementierungen teilen sich eine `PersistenceRoot` und einen `EmbeddedStorageManager`.
Außerdem existieren mehrere „safe accessor"-Workarounds im Domänenmodell
(`safeMetrics()`, `safeGroups()`, null-checks via Reflection), die ausschließlich wegen
EclipseStores Verhalten bei nachträglich hinzugefügten Feldern benötigt werden.

---

## Ziel

Den gesamten EclipseStore-Stack entfernen und durch eine **einfache JSON-Dateipersistenz** ersetzen:

- Der gesamte In-Memory-Objektgraph bleibt unverändert im RAM.
- Gelegentlich (z. B. nach jeder Schreiboperation und/oder per Timer) wird der Graph
  als eine oder mehrere JSON-Dateien auf die Festplatte geschrieben.
- Beim Start werden diese Dateien eingelesen und der Graph rekonstruiert.
- Jackson ist bereits im Classpath vorhanden (`jackson-module-kotlin`).

---

## Vorgeschlagene Architektur

```
data/json/
  mapStates.json     ← Map<String, MapState>
  users.json         ← Map<String, UserRecord>
```

### Neue Klassen (alle in `adapter/out/persistence`)

| Klasse | Aufgabe |
|---|---|
| `JsonPersistenceConfig` | `@Configuration`; erzeugt `ObjectMapper`-Bean mit Kotlin-Modul, JavaTimeModule, `WRITE_DATES_AS_TIMESTAMPS=false` |
| `JsonStore` | Lädt/speichert die beiden Maps aus/in JSON-Dateien; hält den In-Memory-Stand |
| `JsonMapStateRepository` | Implementiert `MapStatePort`; delegiert an `JsonStore` |
| `JsonUserRepository` | Implementiert `UserWritePort`; delegiert an `JsonStore` |

### `JsonStore` – Kernlogik (Pseudocode)

```kotlin
@Component
class JsonStore(private val mapper: ObjectMapper,
                @Value("\${landmarks.storage.path:data/json}") path: String) {

    val mapStates: ConcurrentHashMap<String, MapState>
    val users:     ConcurrentHashMap<String, UserRecord>

    init { /* lade aus Datei oder starte leer */ }

    @Synchronized fun saveMapStates() { /* schreibe mapStates.json */ }
    @Synchronized fun saveUsers()     { /* schreibe users.json     */ }
}
```

### Speicherstrategie: „Debounced Flush" via Dirty-Flag

Statt nach jedem einzelnen Schreibaufruf sofort auf die Platte zu schreiben
(teuer bei vielen schnellen Edits) oder blind in festen Intervallen zu speichern
(speichert auch wenn sich nichts geändert hat), wird ein **Dirty-Flag + Scheduled Flush**
kombiniert:

```kotlin
@Component
class JsonStore(...) {

    @Volatile private var mapStatesDirty = false
    @Volatile private var usersDirty     = false

    fun markMapStatesDirty() { mapStatesDirty = true }
    fun markUsersDirty()     { usersDirty     = true }

    /** Schreibt nur wenn seit dem letzten Flush eine Änderung stattfand. */
    fun saveMapStatesIfDirty() {
        if (!mapStatesDirty) return
        saveMapStates()          // atomares Write (temp → rename)
        mapStatesDirty = false
    }

    fun saveUsersIfDirty() {
        if (!usersDirty) return
        saveUsers()
        usersDirty = false
    }
}
```

Die Repositories setzen das Flag nach jeder Mutation, lösen aber **keinen I/O** aus:

```kotlin
override fun save(state: MapState) {
    mapStates[state.id] = state   // sofort im RAM sichtbar
    store.markMapStatesDirty()    // kein Disk-Write hier
}
```

Der `@Scheduled`-Job prüft das Flag und schreibt **nur bei tatsächlicher Änderung**:

```kotlin
@Scheduled(fixedDelayString = "\${landmarks.storage.flush-interval-ms:5000}")
fun conditionalFlush() {
    store.saveMapStatesIfDirty()
    store.saveUsersIfDirty()
}
```

**Ablauf bei einer Mutation:**

```
UseCase.execute()
  └─▶ JsonMapStateRepository.save(state)
        ├─ mapStates[state.id] = state   (In-Memory, sofort sichtbar)
        └─ store.markMapStatesDirty()    (Flag setzen, kein I/O)

       ... weitere Edits möglich, Flag bleibt true ...

@Scheduled (alle 5 s)
  └─▶ saveMapStatesIfDirty()
        ├─ Flag ist true  → writeAtomic(mapStates.json)
        └─ Flag auf false  setzen

@Scheduled (nächste Runde, keine Änderung)
  └─▶ saveMapStatesIfDirty()
        └─ Flag ist false → kein I/O
```

**Eigenschaften:**

- Kein unnötiger Disk-I/O bei unverändertem Zustand.
- Mehrere schnell aufeinanderfolgende Edits werden zu einem einzigen Write zusammengefasst
  (natürliches Debouncing durch den Scheduler-Takt).
- Maximales Datenverlustfenster = konfiguriertes Intervall (Default 5 s).
- Beim geordneten Shutdown (`@PreDestroy`) wird ein abschließendes Flush ausgeführt,
  damit kein ausstehender Write verloren geht:

```kotlin
@PreDestroy
fun flushOnShutdown() {
    store.saveMapStatesIfDirty()
    store.saveUsersIfDirty()
}
```

Erfordert `@EnableScheduling` in der Applikationsklasse.

### Jackson-Konfiguration: Enums als Strings

Alle Enums (`LandmarkType`, `Terrain`, `ConnectionType`, `QualityLevel` …) werden
als **String-Name** (nicht als Ordinal-Zahl) serialisiert. Das macht die JSON-Dateien
lesbar und entkoppelt die Persistenz von der Reihenfolge der Enum-Konstanten:

```kotlin
// In JsonPersistenceConfig:
mapper.enable(SerializationFeature.WRITE_ENUMS_USING_TO_STRING)
mapper.enable(DeserializationFeature.READ_ENUMS_USING_TO_STRING)
```

Oder alternativ global via `application.yml`:

```yaml
spring:
  jackson:
    serialization:
      write-enums-using-to-string: true
    deserialization:
      read-enums-using-to-string: true
```

**Konsequenz:** Enum-Konstanten dürfen nicht umbenannt werden, ohne einen
`@JsonAlias("ALTER_NAME")` an der neuen Konstante hinzuzufügen – analog zur bisherigen
`PersistenceRefactoringMappingProvider`-Logik in EclipseStore, jedoch deutlich leichtgewichtiger.

---

### Jackson-Konfiguration für `HexMap` / `HexCoordinate`

`HexMap` verwendet intern eine `MutableMap<HexCoordinate, HexTile>`.
`HexCoordinate` ist eine `data class(val q: Int, val r: Int)` – kein String-Schlüssel.
Jackson braucht dafür einen `KeyDeserializer` oder die Map wird als Liste von Einträgen
serialisiert. **Empfehlung:** `@JsonSerialize`/`@JsonDeserialize` mit einem einfachen
`q:r`-String-Key-Mechanismus, oder `HexMap` bekommt eine dedizierte Jackson-Darstellung
(z. B. als `List<HexTile>`, der Konstruktor nimmt bereits `List<HexTile>`).

### Start ohne bestehende Daten

Beim ersten Start mit der neuen Version fehlen JSON-Dateien → `DataInitializer` erzeugt
einen Default-Zustand (identisch zum allerersten Start der Anwendung). Bestehende
EclipseStore-Binärdaten werden nicht übernommen.

---

## Umfang der Änderungen

### Zu entfernen

- `EclipseStoreConfig.kt`
- `EclipseStoreMapStateRepository.kt`
- `EclipseStoreUserRepository.kt`
- `PersistenceRoot.kt`
- `EclipseStoreMapStateRepositoryTest.kt`
- Maven-Abhängigkeiten `storage-embedded` und `storage-embedded-configuration`
- `PersistenceRefactoringMappingProvider`-Logik (LandmarkType-Renames → nicht mehr nötig)

### Zu vereinfachen (Domänenmodell)

- `MapState.safeGroups()` → entfernen (Jackson initialisiert `val groups` korrekt)
- `MapState.safeMetrics()` → entfernen inkl. Reflection-Fallback
- `Landmark.safeMetrics()` → entfernen
- Alle `@Suppress("UNNECESSARY_SAFE_CALL")`-Annotationen auf diesen Accessoren entfernen

### Zu erstellen

- `JsonPersistenceConfig.kt`
- `JsonStore.kt`
- `JsonMapStateRepository.kt`
- `JsonUserRepository.kt`
- `JsonMapStateRepositoryTest.kt` (analog zum bestehenden EclipseStore-Test)

### Zu ändern

- `pom.xml`: EclipseStore-Deps entfernen, ggf. `jackson-datatype-jsr310` explizit hinzufügen
  (ist via Spring Boot BOM oft transitiv verfügbar)
- `application.yml`: `landmarks.storage.path` zeigt jetzt auf `data/json`
- `LandmarksApplication.kt`: `@EnableScheduling` hinzufügen (wenn periodisches Flush gewünscht)
- `surefire`-Konfiguration in `pom.xml`: `landmarks.test.storage.path` anpassen

---

## Pro & Contra

### ✅ Vorteile (JSON)

| # | Vorteil | Detail |
|---|---|---|
| 1 | **Kein proprietäres Binärformat** | JSON ist mit jedem Text-Editor lesbar, diff-bar und versionierbar (z. B. in Git). |
| 2 | **Drastisch vereinfachtes Persistenzmodell** | `save(state)` = `mapper.writeValue(file, map)`. Keine manuelle `storageManager.store()`-Aufrufe für jedes Sub-Objekt. |
| 3 | **Kein „Dirty-Tracking"** | EclipseStore erfordert genaue Kenntnis, welche Objekte verändert wurden. Bei JSON wird einfach der gesamte Stand geschrieben. |
| 4 | **Domänenmodell säubern** | Die `safeMetrics()`/`safeGroups()`-Hacks und die Reflection im Domänenmodell fallen weg. |
| 5 | **Keine Refactoring-Mapping-Provider** | Enum-Umbenennungen sind über Jackson-`@JsonAlias` oder einen einfachen `ObjectMapper`-Deserializer handhabbar. |
| 6 | **Testbarkeit** | Tests können `InMemoryMapStateRepository` nutzen oder temporäre Verzeichnisse (`@TempDir`). Kein `TestStorageCleaner` nötig. |
| 7 | **Keine externe Abhängigkeit mit speziellen Klassenlade-Anforderungen** | EclipseStore greift tief in die JVM-Objekte ein; Kompatibilitätsprobleme mit GraalVM Native oder bestimmten JVM-Versionen entfallen. |
| 8 | **Deployment vereinfacht** | Docker-Image wird kleiner (keine EclipseStore-JARs). |

### ❌ Nachteile / Risiken (JSON)

| # | Nachteil | Detail |
|---|---|---|
| 1 | **Datenverlust bei Absturz zwischen Writes** | EclipseStore schreibt transaktional (append-only log). JSON-Write ist nicht atomar: Absturz während des Schreibens kann die Datei korrumpieren. **Minderung:** atomares Schreiben via temp-Datei + rename (OS-atomar). |
| 2 | **Kein inkrementelles Speichern** | Bei großen Maps wird immer der gesamte Stand geschrieben. EclipseStore schreibt nur das geänderte Objekt. **Minderung:** für die aktuelle Datenmenge (typisch ≤ einige MB) vernachlässigbar. |
| 3 | **Kein Änderungs-Journal / Audit-Trail** | EclipseStore's append-only-Log erlaubt Point-in-Time-Recovery. JSON überschreibt immer. **Minderung:** regelmäßige Backup-Kopien (`data.YYYYMMDD-HHmmss.json`). |
| 4 | **Serialisierung zyklischer Graphen** | Jackson behandelt zyklische Referenzen nicht automatisch. Im aktuellen Modell gibt es keine Zyklen, das muss aber sichergestellt werden. |
| 5 | **HexCoordinate als Map-Key** | `HexCoordinate` ist kein String → braucht `@JsonKey`-Annotation oder Custom KeySerializer/Deserializer. Kleiner, einmaliger Implementierungsaufwand. |
| 6 | **Locking-Semantik explizit implementieren** | EclipseStore's `storageManager.store()` liefert implizit ein Locking-Signal. In der JSON-Variante muss `synchronized`/`ReentrantLock` explizit auf Datei-Ebene gelten. Das ist aber auch jetzt schon per `mapLocks` gelöst – es muss nur beibehalten werden. |
| 7 | **Kein bestehender Migrationspfad** | Bestehende Produktionsdaten im EclipseStore-Format sind nicht direkt migrierbar. |
| 8 | **Kein „Lazy Loading"** | EclipseStore kann Teile des Graphen on-demand laden. JSON lädt beim Start alles in einem Stück. Bei sehr großen Datensätzen (> 100 MB) könnte das den Start verlangsamen. Für das aktuelle Projekt irrelevant. |

---

## Bewertung / Empfehlung

Für das aktuelle Projekt (single-node, moderate Datenmenge, kein Multi-Instance-Deployment)
überwiegen die Vorteile klar. Die kritischsten Risiken (Dateikorruption bei Absturz,
fehlender Audit-Trail) sind mit atomarem Write + periodischen Backup-Snapshots ausreichend
abgemildert.

**Empfohlene Implementierungsreihenfolge:**

1. `JsonPersistenceConfig` + `JsonStore` mit atomarem Write (temp → rename)
2. `JsonMapStateRepository` + `JsonUserRepository`
3. HexCoordinate-KeySerializer/-Deserializer schreiben und testen
4. Domänenmodell säubern (safe-Accessor-Methoden entfernen, Use Cases anpassen)
5. EclipseStore-Klassen + Maven-Deps entfernen
6. Tests anpassen (`TestStorageCleaner` entfernen, `@TempDir` in Tests)
7. Optional: `@Scheduled`-Flush + Backup-Snapshots

---

## Beispiel: atomares JSON-Write

```kotlin
private fun writeAtomic(file: Path, data: Any) {
    val tmp = file.resolveSibling(file.fileName.toString() + ".tmp")
    mapper.writerWithDefaultPrettyPrinter().writeValue(tmp.toFile(), data)
    Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE)
}
```

## Beispiel: HexCoordinate Key-Serialisierung

```kotlin
class HexCoordinateKeySerializer : JsonSerializer<HexCoordinate>() {
    override fun serialize(value: HexCoordinate, gen: JsonGenerator, p: SerializerProvider) =
        gen.writeFieldName("${value.q}:${value.r}")
}

class HexCoordinateKeyDeserializer : KeyDeserializer() {
    override fun deserializeKey(key: String, ctxt: DeserializationContext): HexCoordinate {
        val (q, r) = key.split(":").map { it.toInt() }
        return HexCoordinate(q, r)
    }
}
```

