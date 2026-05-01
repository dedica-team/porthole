# Plan: AuthorizationService einführen — UserPort & AdminService aus allen Controllern entfernen

## Ziel

Die hexagonale Architektur wird aktuell an zwei Stellen verletzt:

1. **`AdminService`** (ein Web-Adapter aus `adapter.in.web.security`) wird direkt in Use Cases der Applikationsschicht injiziert (`DeleteMapUseCase`, `AdminJoinMapUseCase`, `RemoveCollaboratorUseCase`).
2. **`UserPort`** wird in fast allen Use Cases ausschließlich für den Lookup `username → UUID` benutzt — ein unnötiger DB-Roundtrip, der nur nötig ist, weil der `JwtAuthenticationFilter` lediglich den `username` im `UserDetails`-Principal speichert, obwohl das JWT bereits die `userId` enthält.

**Ergebnis nach diesem Plan:** Alle Use Cases erhalten eine `UUID` (userId) direkt vom Controller, und Autorisierungsprüfungen laufen über einen sauber abgegrenzten `AuthorizationPort` in der Applikationsschicht.

---

## Hintergrund: Das eigentliche Problem mit `user.username`

Der `JwtAuthenticationFilter` löst beim Request die `userId` aus dem JWT auf, lädt den `UserRecord` aus dem Repository und legt dann **nur den `username`** ins Spring-`UserDetails`-Objekt:

```kotlin
// JwtAuthenticationFilter.kt
val principal = User(userRecord.username, "", authorities)  // userId geht verloren!
```

Anschließend ruft jeder Use Case `userPort.findByUsername(username)` auf, um die UUID zurückzubekommen. Das ist ein unnötiger Lookup.

**Lösung:** Einen eigenen `PortholePrincipal` einführen, der `userId` und `username` trägt, damit Controller die `userId` direkt weiterreichen können.

---

## Schritt 1: `PortholePrincipal` einführen

**Neue Datei:** `adapter/in/web/security/PortholePrincipal.kt`

```kotlin
data class PortholePrincipal(
    val userId: UUID,
    private val username: String,
) : UserDetails {
    override fun getAuthorities() = listOf(SimpleGrantedAuthority("ROLE_USER"))
    override fun getPassword() = ""
    override fun getUsername() = username
    override fun isAccountNonExpired() = true
    override fun isAccountNonLocked() = true
    override fun isCredentialsNonExpired() = true
    override fun isEnabled() = true
}
```

**Änderung in `JwtAuthenticationFilter`:** Statt `User(userRecord.username, ...)` wird `PortholePrincipal(userRecord.id, userRecord.username)` gesetzt.

```kotlin
// vorher:
val principal = User(userRecord.username, "", authorities)
// nachher:
val principal = PortholePrincipal(userId = userRecord.id, username = userRecord.username)
val auth = UsernamePasswordAuthenticationToken(principal, null, principal.authorities)
```

**Alle Controller** müssen den Typ von `UserDetails` auf `PortholePrincipal` umstellen und können danach `user.userId` direkt weitergeben.

---

## Schritt 2: `SessionRole`-Enum im Domain-Modell definieren

**Neue Datei:** `domain/SessionRole.kt`

Die Rollen sind hierarchisch geordnet (ADMIN ⊇ COLLABORATOR ⊇ REQUEST_PENDING ⊇ VIEWER). `mustHaveRole(required)` wirft eine `AccessDeniedException`, wenn die eigene Rolle unter der geforderten liegt.

```kotlin
enum class SessionRole {
    VIEWER,           // no relationship to the map
    REQUEST_PENDING,  // has a pending join request
    COLLABORATOR,     // active participant on the map
    ADMIN;            // global admin (from configuration)

    /** Throws AccessDeniedException if this role is less privileged than [required]. */
    fun mustHaveRole(required: SessionRole) {
        if (this.ordinal < required.ordinal)
            throw AccessDeniedException("User is not a $required in the session.")
    }
}
```

---

## Schritt 3: `AuthorizationPort` als Application Port definieren

**Neue Datei:** `application/port/AuthorizationPort.kt`

Der Port hat **genau eine Methode**. Sie lädt den `SessionState`, prüft die Rolle des Nutzers und wirft eine `AccessDeniedException` wenn `requiredRole` nicht erfüllt wird. Bei Erfolg gibt sie den geladenen `SessionState` zurück — dadurch entfällt ein zweites Laden im Use Case.

```kotlin
interface AuthorizationPort {
    /**
     * Loads and returns the [SessionState] for [sessionId], enforcing that [userId]
     * has at least [requiredRole]. Throws:
     * - NoSuchElementException  if the session does not exist
     * - AccessDeniedException   if the user's role is below [requiredRole]
     *
     * Admins always pass regardless of [requiredRole].
     */
    fun accessSession(userId: UUID, sessionId: UUID, requiredRole: SessionRole): SessionState
}
```

> **Schlüsselentscheidung:** `accessSession()` gibt `SessionState` zurück. Use Cases müssen den State danach **nicht erneut laden**. Das vermeidet den doppelten `MapState`/`SessionState`-Lookup aus dem vorherigen Planstand.

---

## Schritt 4: `AuthorizationService` als Adapter implementieren

**Neue Datei:** `adapter/out/authorization/AuthorizationService.kt`

```kotlin
@Component
class AuthorizationService(
    private val adminService: AdminService,
    private val sessionStatePort: SessionStatePort,
) : AuthorizationPort {

    override fun accessSession(userId: UUID, sessionId: UUID, requiredRole: SessionRole): SessionState {
        val state = sessionStatePort.findById(sessionId)
            ?: throw NoSuchElementException("Session $sessionId not found")

        if (adminService.isAdmin(userId)) {
            return state
        }

        val role = when {
            state.isCollaborator(userId)    -> SessionRole.COLLABORATOR
            state.hasPendingRequest(userId) -> SessionRole.REQUEST_PENDING
            else                            -> SessionRole.VIEWER
        }
        role.mustHaveRole(requiredRole)

        return state
    }
}
```

`AdminService` bleibt im Web-Adapter-Paket und wird nicht nach außen exponiert.

---

## Schritt 5: `SessionState`-Methoden bereinigen

`requireCollaborator` und `requireReadAccess` werden aus `SessionState` entfernt — die Prüfungslogik liegt jetzt vollständig in `AuthorizationService` über `mustHaveRole`.

Die lesenden Hilfsmethoden `isCollaborator()` und `hasPendingRequest()` bleiben erhalten — sie werden intern von `AuthorizationService` genutzt.

```kotlin
// SessionState.kt — zu entfernen:
fun requireCollaborator(userId: UUID) { ... }  // → accessSession(..., SessionRole.COLLABORATOR)
fun requireReadAccess(userId: UUID) { ... }    // → accessSession(..., SessionRole.VIEWER) für OPEN, COLLABORATOR für PRIVATE

// SessionState.kt — bleibt:
fun isCollaborator(userId: UUID): Boolean
fun hasPendingRequest(userId: UUID): Boolean
fun getCollaborator(collaboratorId: UUID): Collaborator?
fun getLandmarksOf(collaboratorId: UUID): List<Landmark>
fun getLandmarkAt(coordinate: HexCoordinate): Landmark?
```

---

## Schritt 6: `AuthUtil` löschen

`AuthUtil` verwendet aktuell `UserPort` + `SessionStatePort` und ruft `state.requireReadAccess()` auf. Nach der Migration ist `AuthUtil` obsolet — Use Cases rufen `authorizationPort.accessSession(userId, sessionId, SessionRole.VIEWER)` auf. `AuthUtil` kann gelöscht werden.

```kotlin
// vorher (in Use Cases via AuthUtil):
AuthUtil.with(userPort, sessionStatePort).ensureUserHasReadAccessInMap(userId, sessionId)

// nachher:
val state = authorizationPort.accessSession(userId, sessionId, SessionRole.VIEWER)
```

---

## Schritt 7: Use Cases refaktorieren

### Verwendungsmuster in allen Use Cases

Das neue einheitliche Muster für **jeden** Use Case:

```kotlin
// vorher (typisches Muster):
val state = sessionStatePort.findById(sessionId) ?: throw NoSuchElementException(...)
val user = userPort.findByUsername(username) ?: throw NoSuchElementException(...)
state.requireCollaborator(user.id)
// ... benutze state ...

// nachher:
val state = authorizationPort.accessSession(userId, sessionId, SessionRole.COLLABORATOR)
// ... benutze state direkt — kein zweites Laden nötig ...
```

Für reine Leseoperationen (z.B. `ListMetricsUseCase`, `ListChoreListsUseCase`):

```kotlin
// vorher:
val state = sessionStatePort.findById(sessionId) ?: throw ...
userPort.findByUsername(username) ?: throw ...   // nur zur Existenzprüfung

// nachher:
val state = authorizationPort.accessSession(userId, sessionId, SessionRole.VIEWER)
```

Für Admin-only-Aktionen (z.B. `DeleteSessionUseCase`, `RemoveCollaboratorUseCase`):

```kotlin
val state = authorizationPort.accessSession(userId, sessionId, SessionRole.ADMIN)
```

Für den speziellen Assignee-Check (z.B. in `UpdateChoreEntryUseCase`):

```kotlin
// vorher:
require(mapState.isCollaborator(assigneeId)) { "Assignee $assigneeId is not a collaborator" }

// nachher: accessSession wirft bei VIEWER → funktioniert auch als Boolean-Ersatz
runCatching { authorizationPort.accessSession(assigneeId, sessionId, SessionRole.COLLABORATOR) }.isSuccess
// oder einfach: state.isCollaborator(assigneeId) — da state bereits geladen ist
```

### 7a: Use Cases mit `AdminService`-Import (Architekturverstoß)

| Use Case | Änderung |
|---|---|
| `DeleteMapUseCase` | `AdminService` → `authorizationPort.accessSession(callerId, mapId, SessionRole.ADMIN)` |
| `AdminJoinMapUseCase` | `AdminService` + `UserPort.findByUsername` → `accessSession(..., ADMIN)` + `userPort.findById(callerId)` für Avatar |
| `RemoveCollaboratorUseCase` | `AdminService` + `UserPort` → `accessSession(..., ADMIN)` |

### 7b: Use Cases mit `UserPort` nur für `username → UUID`

**Lobby:**
- `CreateMapUseCase` — Parameter `creatorUsername: String` → `creatorId: UUID` + `creatorUsername: String`; `userPort.findById(creatorId)` statt `findByUsername`
- `JoinMapUseCase` — `callerId: UUID` direkt; `userPort.findById(callerId)`
- `RequestJoinUseCase` — `callerId: UUID` direkt; `userPort.findById(callerId)`
- `ListMapsUseCase` — `callerId: UUID?` direkt; `UserPort` komplett entfernen
- `GetMapUseCase` — `callerId: UUID?` direkt; `userPort.findByUsername` bleibt nur für Avatar-Refresh

**Session (alle):** alle `username: String`-Parameter werden zu `userId: UUID`; `userPort.findByUsername` entfällt; `accessSession` übernimmt Prüfung und Laden des State.

### 7c: Betroffene Use Cases (vollständige Liste)

- **processes/**: `AddStageConnectionUseCase`, `EditProcessUseCase`, `RemoveStageConnectionUseCase`, `EditProcessStageUseCase`, `AddProcessStageUseCase`, `EditStageConnectionUseCase`, `RemoveProcessUseCase`, `CreateProcessUseCase`, `ReorderProcessStagesUseCase`, `RemoveProcessStageUseCase`, `ListProcessesUseCase`
- **chorelists/**: `UpdateChoreEntryUseCase`, `ToggleChoreListCompletedUseCase`, `RemoveChoreListUseCase`, `EditChoreListUseCase`, `CreateChoreListUseCase`, `ListChoreListsUseCase`
- **landscaping/**: `EditLandmarkUseCase`, `PlaceLandmarkUseCase`, `EditTileUseCase`, `PositionLandmarkUseCase`, `RemoveLandmarkUseCase`, `RemoveConnectionUseCase`, `CreateConnectionUseCase`, `EditConnectionUseCase`, `EditMapUseCase`, `ChangeLandmarkOwnerUseCase`
- **collaboration/**: `SetCollaborationModeUseCase`, `AcceptJoinRequestUseCase`, `DeclineJoinRequestUseCase`
- **metrics/**: `EditCollaboratorMatrixUseCase`, `CreateMetricUseCase`, `ClearLandmarkMetricUseCase`, `EditMetricUseCase`, `SetLandmarkMetricUseCase`, `RemoveMetricUseCase`, `ClearMatrixEntryUseCase`, `CreateGroupUseCase`, `EditGroupUseCase`, `RemoveGroupUseCase`, `GetCollaboratorMatrixUseCase`, `ListMetricsUseCase`, `CreateUnpositionedLandmarkUseCase`, `SetMatrixEntryUseCase`

---

## Schritt 8: Controller refaktorieren

### Alle Map/Session-Controller

- Typen `UserDetails` → `PortholePrincipal` bei `@AuthenticationPrincipal`
- `user.username` → `user.userId` an Use Cases übergeben
- `resolveUserId()`-Hilfsmethoden entfernen
- `adminService`- und `userPort`-Constructor-Parameter aus `MapController` entfernen

### `OAuthController` und `WebAuthnController`

Verwenden `adminService.isAdmin(user.id)` für das `isAdmin`-Flag in `AuthResponse` — `adminService` bleibt hier als explizite Adapter-Abhängigkeit.

---

## Schritt 9: Tests aktualisieren

### 9a: `TestPorts.kt` — `InMemoryAuthorizationPort` hinzufügen

```kotlin
class InMemoryAuthorizationPort : AuthorizationPort {
    private val roles = mutableMapOf<Pair<UUID, UUID>, SessionRole>()
    private val adminIds = mutableSetOf<UUID>()
    // Muss auch findById-Verhalten anbieten, da accessSession den State zurückgibt
    private lateinit var sessionStatePort: InMemorySessionStatePort

    fun withStatePort(port: InMemorySessionStatePort) = apply { this.sessionStatePort = port }
    fun setRole(userId: UUID, sessionId: UUID, role: SessionRole) { roles[userId to sessionId] = role }
    fun makeAdmin(userId: UUID) { adminIds += userId }

    override fun accessSession(userId: UUID, sessionId: UUID, requiredRole: SessionRole): SessionState {
        val state = sessionStatePort.findById(sessionId)
            ?: throw NoSuchElementException("Session $sessionId not found")
        if (userId in adminIds) return state
        val role = roles[userId to sessionId] ?: SessionRole.VIEWER
        role.mustHaveRole(requiredRole)
        return state
    }
}
```

### 9b: Use-Case-Unit-Tests anpassen

```kotlin
// vorher:
private lateinit var userPort: InMemoryTestUserRepository

@BeforeEach
fun setup() {
    userPort = InMemoryTestUserRepository().also {
        it.save(UserRecord(aliceId, "Alice", "gh-1"))
    }
    useCase = PlaceLandmarkUseCase(sessionStatePort, userPort, NoOpBroadcastPort())
}

// nachher:
private lateinit var authPort: InMemoryAuthorizationPort
private val aliceId = UUID.nameUUIDFromBytes("p1".toByteArray())

@BeforeEach
fun setup() {
    authPort = InMemoryAuthorizationPort()
        .withStatePort(sessionStatePort)
        .also { it.setRole(aliceId, state.id, SessionRole.COLLABORATOR) }
    useCase = PlaceLandmarkUseCase(authPort, NoOpBroadcastPort())
}
```

Zugangsverweigerungstests:

```kotlin
@Test
fun `non-collaborator cannot place landmark`() {
    authPort.setRole(aliceId, state.id, SessionRole.VIEWER)
    assertThrows<AccessDeniedException> {
        useCase.execute(state.id, aliceId, HexCoordinate(0, 0), "Iron Keep")
    }
}
```

### 9c: Neue Unit-Tests für `SessionRole.mustHaveRole()`

**Neue Datei:** `domain/SessionRoleTest.kt`

```kotlin
class SessionRoleTest {

    @Test
    fun `ADMIN passes all role checks`() {
        SessionRole.entries.forEach { required ->
            assertDoesNotThrow { SessionRole.ADMIN.mustHaveRole(required) }
        }
    }

    @Test
    fun `VIEWER only passes VIEWER check`() {
        assertDoesNotThrow { SessionRole.VIEWER.mustHaveRole(SessionRole.VIEWER) }
        assertThrows<AccessDeniedException> { SessionRole.VIEWER.mustHaveRole(SessionRole.REQUEST_PENDING) }
        assertThrows<AccessDeniedException> { SessionRole.VIEWER.mustHaveRole(SessionRole.COLLABORATOR) }
        assertThrows<AccessDeniedException> { SessionRole.VIEWER.mustHaveRole(SessionRole.ADMIN) }
    }

    @Test
    fun `COLLABORATOR passes VIEWER and COLLABORATOR but not ADMIN`() {
        assertDoesNotThrow { SessionRole.COLLABORATOR.mustHaveRole(SessionRole.VIEWER) }
        assertDoesNotThrow { SessionRole.COLLABORATOR.mustHaveRole(SessionRole.COLLABORATOR) }
        assertThrows<AccessDeniedException> { SessionRole.COLLABORATOR.mustHaveRole(SessionRole.ADMIN) }
    }

    @Test
    fun `mustHaveRole is reflexive for all roles`() {
        SessionRole.entries.forEach { role ->
            assertDoesNotThrow("$role should pass its own check") { role.mustHaveRole(role) }
        }
    }
}
```

### 9d: Unit-Tests für `AuthorizationService`

**Neue Datei:** `adapter/out/authorization/AuthorizationServiceTest.kt`

```kotlin
class AuthorizationServiceTest {

    private lateinit var sessionStatePort: InMemorySessionStatePort
    private lateinit var adminService: AdminService
    private lateinit var service: AuthorizationService

    private val userId = UUID.randomUUID()
    private val adminId = UUID.randomUUID()
    private val sessionId = UUID.randomUUID()

    @BeforeEach
    fun setup() {
        sessionStatePort = InMemorySessionStatePort()
        adminService = AdminService(adminId.toString())
        service = AuthorizationService(adminService, sessionStatePort)
    }

    @Test
    fun `throws NoSuchElementException when session does not exist`() {
        assertThrows<NoSuchElementException> {
            service.accessSession(userId, sessionId, SessionRole.VIEWER)
        }
    }

    @Test
    fun `VIEWER role passes VIEWER check on existing session`() {
        sessionStatePort.save(emptySession())
        val state = service.accessSession(userId, sessionId, SessionRole.VIEWER)
        assertNotNull(state)
    }

    @Test
    fun `VIEWER role fails COLLABORATOR check`() {
        sessionStatePort.save(emptySession())
        assertThrows<AccessDeniedException> {
            service.accessSession(userId, sessionId, SessionRole.COLLABORATOR)
        }
    }

    @Test
    fun `COLLABORATOR passes COLLABORATOR check`() {
        val s = emptySession()
        s.collaborators.add(Collaborator(id = userId, username = "alice"))
        sessionStatePort.save(s)
        assertDoesNotThrow { service.accessSession(userId, sessionId, SessionRole.COLLABORATOR) }
    }

    @Test
    fun `REQUEST_PENDING fails COLLABORATOR check`() {
        val s = emptySession()
        s.joinRequests.add(JoinRequest(userId = userId, username = "alice"))
        sessionStatePort.save(s)
        assertThrows<AccessDeniedException> {
            service.accessSession(userId, sessionId, SessionRole.COLLABORATOR)
        }
    }

    @Test
    fun `ADMIN bypasses all role checks`() {
        sessionStatePort.save(emptySession())
        SessionRole.entries.forEach { required ->
            assertDoesNotThrow { service.accessSession(adminId, sessionId, required) }
        }
    }

    private fun emptySession() = SessionState(id = sessionId, map = HexMap.createGrid(10, 10))
}
```

### 9e: `JwtAuthenticationFilter`-Tests anpassen

```kotlin
// vorher:
val principal = authentication.principal as User
assertEquals("testuser", principal.username)

// nachher:
val principal = authentication.principal as PortholePrincipal
assertEquals(testUserId, principal.userId)
assertEquals("testuser", principal.username)
```

### 9f: `MapControllerTest` anpassen

Keine strukturellen Änderungen am JWT-Flow nötig. `setup()` nutzt künftig `userId` direkt:

```kotlin
val userId = UUID.nameUUIDFromBytes("test-uid-001".toByteArray())
token = jwtTokenProvider.generateToken(userId, "testuser")
// JWT-Filter setzt PortholePrincipal(userId, "testuser") — kein userPort-Lookup im Controller mehr
```

---

## Migrationreihenfolge

1. `PortholePrincipal` erstellen + `JwtAuthenticationFilter` anpassen; Tests auf `PortholePrincipal` umstellen (Schritt 9e)
2. Alle Controller auf `PortholePrincipal` umstellen (compile-check)
3. `SessionRole`-Enum erstellen + `SessionRoleTest` schreiben (Schritt 9c)
4. `AuthorizationPort`-Interface erstellen
5. `InMemoryAuthorizationPort` in `TestPorts.kt` ergänzen (Schritt 9a)
6. `AuthorizationService`-Implementierung erstellen + `AuthorizationServiceTest` schreiben (Schritt 9d)
7. Use Cases mit direktem `AdminService`-Import migrieren (Schritt 7a); Tests anpassen (Schritt 9b)
8. Rest der Use Cases: `userId` direkt übernehmen, `userPort.findByUsername()` entfernen, `accessSession` einführen (Schritt 7b + 7c)
9. `AuthUtil` löschen
10. `requireCollaborator()` und `requireReadAccess()` aus `SessionState` entfernen (Schritt 5)
11. `MapControllerTest` anpassen (Schritt 9f)
12. `UserPort` aus den Use Cases entfernen, die ihn nicht mehr brauchen (finale Bereinigung)

---

## Risiken & Sonderfälle

| # | Risiko | Maßnahme |
|---|---|---|
| 1 | **`AcceptJoinRequestUseCase`** braucht `userPort.findByUsername(joinRequest.username)` für den Requester-Avatar | Nur der Caller-Lookup entfällt; Requester-Lookup per `findByUsername` bleibt |
| 2 | **`WebSocketHandshakeAuthInterceptor`** baut Auth-Session auf und nutzt `UserPort` | Auch dort `PortholePrincipal` verwenden |
| 3 | **GitHub/Keycloak SSO-Handler** setzen das `UserDetails`-Objekt im Security-Context | Auch dort `PortholePrincipal` einsetzen |
| 4 | **`UpdateChoreEntryUseCase` Assignee-Check**: `state.isCollaborator(assigneeId)` — State ist nach `accessSession()` bereits vorhanden | `state.isCollaborator(assigneeId)` direkt nutzen (kein zweiter Port-Aufruf nötig) |
| 5 | **`DeleteMapUseCase`** braucht keinen geladenen State (nur löschen) — `accessSession` lädt ihn trotzdem | Akzeptabler Trade-off; alternativ kann `accessSession` ein Flag `loadState: Boolean = true` erhalten |
| 6 | **`GetMapUseCase`** nutzt `userPort.findByUsername()` für Avatar-Refresh aller Collaboratoren — dieser Lookup bleibt aus fachlichen Gründen | Nicht entfernen |
| 7 | **`ListMapsUseCase`** prüft PRIVATE-Sichtbarkeit ohne `accessSession` (kein einzelner Session-Kontext) | `isCollaborator(callerId)` direkt auf State-Objekt nutzen; kein `accessSession`-Aufruf nötig |
