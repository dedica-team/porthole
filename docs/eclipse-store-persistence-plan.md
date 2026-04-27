# Plan: EclipseStore als Persistenz-Schicht im Backend

## Ziel

Ersetze die flüchtigen In-Memory-`ConcurrentHashMap`-Repositories durch **EclipseStore** (ehemals MicroStream).  
EclipseStore speichert den Java/Kotlin-Objektgraph direkt auf dem Dateisystem (oder in einem anderen Storage-Target) – **ohne ORM, ohne SQL, ohne Schema-Migration**.

---

## Ist-Zustand

| Schicht | Klasse | Speicherung |
|---|---|---|
| Repository | `MapStateRepository` | `ConcurrentHashMap<String, MapState>` (RAM) |
| Repository | `UserRepository` | `ConcurrentHashMap<String, UserRecord>` (RAM) |
| Port | `MapStatePort` | Interface: `findById`, `save`, `findAll` |
| Port | `UserPort` | Interface: `findByUsername` |

Alle Daten gehen beim Neustart verloren.

---

## Ziel-Architektur

```
adapter/out/persistence/
    EclipseStoreConfig.kt          ← StorageManager & Root-Objekt als Spring Beans
    PersistenceRoot.kt             ← "Root"-Datenobjekt das EclipseStore verwaltet
    EclipseStoreMapStateRepository.kt  ← implementiert MapStatePort
    EclipseStoreUserRepository.kt      ← implementiert UserPort (+ save/exists Methoden)
```

Die bestehenden Port-Interfaces bleiben **unverändert**.  
`MapStateRepository` und `UserRepository` werden durch die EclipseStore-Varianten ersetzt (oder deaktiviert via `@Primary` / Profil).

---

## Schritt-für-Schritt-Plan

### Schritt 1 – Maven-Abhängigkeit hinzufügen

In `server/pom.xml`:

```xml
<!-- EclipseStore -->
<dependency>
    <groupId>org.eclipse.store</groupId>
    <artifactId>storage-embedded</artifactId>
    <version>1.4.0</version>
</dependency>
<dependency>
    <groupId>org.eclipse.store</groupId>
    <artifactId>storage-embedded-configuration</artifactId>
    <version>1.4.0</version>
</dependency>
```

Den Versions-String als Property in den Root-`pom.xml` auslagern:
```xml
<eclipsestore.version>1.4.0</eclipsestore.version>
```

---

### Schritt 2 – `PersistenceRoot` anlegen

**Datei:** `adapter/out/persistence/PersistenceRoot.kt`

```kotlin
package team.dedica.porthole.adapter.out.persistence

import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.domain.MapState
import java.util.concurrent.ConcurrentHashMap

/**
 * Das einzige Objekt, das EclipseStore als Wurzel verwaltet.
 * Alle persistierten Daten hängen als Felder hier dran.
 */
class PersistenceRoot {
    val mapStates: ConcurrentHashMap<String, MapState> = ConcurrentHashMap()
    val users: ConcurrentHashMap<String, UserRecord>   = ConcurrentHashMap()
}
```

> **Warum ein Root-Objekt?**  
> EclipseStore verfolgt den Objektgraph ab einem einzigen Root. Alles, was von hier erreichbar ist, wird automatisch gespeichert. Änderungen müssen danach explizit mit `storageManager.store(changedObject)` bestätigt werden.

---

### Schritt 3 – `EclipseStoreConfig` anlegen

**Datei:** `adapter/out/persistence/EclipseStoreConfig.kt`

```kotlin
package team.dedica.porthole.adapter.out.persistence

import org.eclipse.store.storage.embedded.types.EmbeddedStorage
import org.eclipse.store.storage.embedded.types.EmbeddedStorageManager
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import java.nio.file.Paths

@Configuration
class EclipseStoreConfig {

    @Value("\${landmarks.storage.path:data/eclipse-store}")
    private lateinit var storagePath: String

    @Bean(destroyMethod = "shutdown")
    fun storageManager(root: PersistenceRoot): EmbeddedStorageManager {
        val manager = EmbeddedStorage.start(root, Paths.get(storagePath))
        return manager
    }

    @Bean
    fun persistenceRoot(storageManager: EmbeddedStorageManager): PersistenceRoot {
        // Wenn der Store leer ist, wird root initialisiert und gleich persistiert.
        return storageManager.root() as? PersistenceRoot
            ?: PersistenceRoot().also {
                storageManager.setRoot(it)
                storageManager.storeRoot()
            }
    }
}
```

> **Hinweis:** `destroyMethod = "shutdown"` sorgt dafür, dass Spring den Store beim Herunterfahren sauber schließt (Flush aller pending Writes).

---

### Schritt 4 – `EclipseStoreMapStateRepository` anlegen

**Datei:** `adapter/out/persistence/EclipseStoreMapStateRepository.kt`

```kotlin
package team.dedica.porthole.adapter.out.persistence

import org.eclipse.store.storage.embedded.types.EmbeddedStorageManager
import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Repository
import team.dedica.porthole.application.port.MapStatePort
import team.dedica.porthole.domain.MapState

@Primary          // ersetzt die alte In-Memory-Implementierung
@Repository
class EclipseStoreMapStateRepository(
    private val root: PersistenceRoot,
    private val storageManager: EmbeddedStorageManager,
) : MapStatePort {

    override fun findById(id: String): MapState? = root.mapStates[id]

    override fun save(state: MapState) {
        root.mapStates[state.id] = state
        storageManager.store(root.mapStates)   // nur die Map neu schreiben
    }

    override fun findAll(): List<MapState> = root.mapStates.values.toList()

    fun deleteById(id: String) {
        root.mapStates.remove(id)
        storageManager.store(root.mapStates)
    }
}
```

---

### Schritt 5 – `EclipseStoreUserRepository` anlegen

**Datei:** `adapter/out/persistence/EclipseStoreUserRepository.kt`

```kotlin
package team.dedica.porthole.adapter.out.persistence

import org.eclipse.store.storage.embedded.types.EmbeddedStorageManager
import org.springframework.context.annotation.Primary
import org.springframework.stereotype.Repository
import team.dedica.porthole.adapter.out.repository.UserRecord
import team.dedica.porthole.application.port.UserPort

@Primary
@Repository
class EclipseStoreUserRepository(
    private val root: PersistenceRoot,
    private val storageManager: EmbeddedStorageManager,
) : UserPort {

    override fun findByUsername(username: String): UserRecord? =
        root.users.values.find { it.username == username }

    fun existsByUsername(username: String): Boolean =
        findByUsername(username) != null

    fun save(user: UserRecord) {
        root.users[user.id] = user
        storageManager.store(root.users)
    }
}
```

---

### Schritt 6 – `DataInitializer` anpassen

`DataInitializer` injiziert aktuell die alten Repositories direkt (konkrete Typen).  
Da die neuen Klassen mit `@Primary` annotiert sind, reicht es, die Injection-Typen auf die Interfaces umzustellen – oder die neuen Typen direkt zu verwenden:

```kotlin
@Component
class DataInitializer(
    private val userRepository: EclipseStoreUserRepository,   // war: UserRepository
    private val gameStateRepository: EclipseStoreMapStateRepository, // war: MapStateRepository
    private val passwordEncoder: PasswordEncoder,
) : ApplicationRunner { ... }
```

---

### Schritt 7 – Konfiguration in `application.yml`

```yaml
landmarks:
  storage:
    path: data/eclipse-store   # relativ zum Arbeitsverzeichnis, oder absoluter Pfad
```

Das Verzeichnis wird beim ersten Start automatisch angelegt.  
Für Tests kann ein temporäres Verzeichnis genutzt werden (`@TempDir` in JUnit 5).

---

### Schritt 8 – Domain-Klassen auf Serialisierbarkeit prüfen

EclipseStore serialisiert Java/Kotlin-Objekte direkt über Reflection – **kein `Serializable`-Interface nötig**.  
Trotzdem gilt es folgende Punkte zu prüfen:

| Klasse | Mögliche Stolperfalle |
|---|---|
| `HexMap` | Interne `MutableMap<HexCoordinate, HexTile>` – muss vollständig erreichbar sein ✓ |
| `MapState` | `Instant` (java.time) – wird von EclipseStore unterstützt ✓ |
| `HexCoordinate` als Map-Key | Braucht stabiles `equals`/`hashCode` – durch `data class` erfüllt ✓ |
| `PerlinNoise` | Ist `private` in `HexMap.kt` – wird nie persistiert, da kein Feld ✓ |
| Lambdas / anonyme Klassen | Dürfen nicht in persistierten Objekten stecken – aktuell nicht der Fall ✓ |

---

### Schritt 9 – Tests anpassen

Bestehende Unit-Tests (`MapStateRepository`, `UserRepository`) mocken die Repositories sowieso. Für **Integrationstests** der neuen EclipseStore-Repositories:

```kotlin
@TempDir
lateinit var tempDir: Path

private lateinit var manager: EmbeddedStorageManager
private lateinit var repo: EclipseStoreMapStateRepository

@BeforeEach
fun setUp() {
    val root = PersistenceRoot()
    manager = EmbeddedStorage.start(root, tempDir)
    repo = EclipseStoreMapStateRepository(root, manager)
}

@AfterEach
fun tearDown() = manager.shutdown()
```

---

## Dateistruktur nach Umsetzung

```
adapter/out/
    messaging/
        MapStateBroadcaster.kt          (unverändert)
    repository/
        MapStateRepository.kt           (bleibt als Fallback / kann gelöscht werden)
        UserRepository.kt               (bleibt als Fallback / kann gelöscht werden)
    persistence/                        ← NEU
        EclipseStoreConfig.kt
        PersistenceRoot.kt
        EclipseStoreMapStateRepository.kt
        EclipseStoreUserRepository.kt
```

---

## Migrations-Überlegungen

Da die aktuelle Basis keine persistierten Daten hat (alles In-Memory), gibt es **keine Migration**.  
Der `DataInitializer` prüft beim Start, ob Daten existieren, und legt sie neu an – dieses Verhalten bleibt erhalten.

Für künftige Schema-Änderungen an Domain-Klassen bietet EclipseStore einen **Legacy-Type-Handler**-Mechanismus (analog zu JPA `@Column` Refactorings), der bei Bedarf ergänzt werden kann.

---

## Risiken & Alternativen

| Punkt | Bewertung |
|---|---|
| EclipseStore ist nicht transaktional im ACID-Sinne | Für ein Spiel akzeptabel; bei kritischer Konsistenz → PostgreSQL + Spring Data JPA |
| Gleichzeitige Schreibzugriffe | EclipseStore ist thread-safe für einzelne `store()`-Aufrufe; komplexe Transaktionen benötigen applikationsseitige Synchronisation |
| Datenmenge | Für ein Spiel mit wenigen tausend `MapState`-Objekten sehr gut geeignet |
| Portabilität | Storage-Pfad per `application.yml` konfigurierbar → Docker-Volume einfach einzubinden |

