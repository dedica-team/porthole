# Plan: WebAuthn (Passkey) Authentifizierung

> Erstellt: 2026-04-11
> Status: ✅ implementiert + gehärtet

## Konzept

WebAuthn wird als eigenständiger, zweiter Login-Weg **neben GitHub OAuth** hinzugefügt.
Ein neuer Nutzer gibt nur einen **Username** ein, registriert einen Passkey (Biometrie oder
Hardware-Key) und landet direkt im Lobby – ohne GitHub-Konto, ohne Passwort.
Bestandsnutzer (GitHub oder Passkey) können sich mit demselben Passkey-Button erneut anmelden.

Der Button wird clientseitig **nicht gerendert**, wenn `window.PublicKeyCredential` fehlt
(ältere Browser, bestimmte mobile UA).

Challenges leben in einer **In-Memory-`ConcurrentHashMap`** mit TTL; kein Redis, kein
zweiter Persistence-Layer nötig.

---

## Voraussetzungen

| Variable | Beschreibung |
|---|---|
| `landmarks.webauthn.rp-id` | Relying Party ID = Hostname (`localhost` lokal, FQDN in Prod) |
| `landmarks.webauthn.rp-name` | Anzeigename, z. B. `"Landmarks"` |
| `landmarks.webauthn.origin` | Vollständiger Origin, z. B. `https://landmarks.example.com` |

Alle drei Werte kommen aus `application.yml` / Umgebungsvariablen – niemals hartcodiert.

---

## Server (`server`)

### 1. Maven-Dependency – `server/pom.xml`

```xml
<dependency>
    <groupId>com.yubico</groupId>
    <artifactId>webauthn-server-core</artifactId>
    <version>2.5.4</version>
</dependency>
```

`webauthn-server-core` ist eine reine Validierungsbibliothek (kein Spring-Starter nötig).
Yubico pflegt sie aktiv und deckt FIDO2 / WebAuthn Level 2 vollständig ab.

### 2. `UserRecord.kt` – Passkey-Credentials hinzufügen

Neues `data class PasskeyCredential` in `adapter/out/repository/UserRecord.kt`:

```kotlin
data class PasskeyCredential(
    val credentialId: String,          // Base64url-kodiert
    val publicKeyCose: String,         // Base64url-kodiert (COSE-Format)
    val signCount: Long,
    val createdAt: String,             // ISO-8601
)

data class UserRecord(
    val id: String,
    val username: String,
    val githubId: String? = null,          // null für reine Passkey-Nutzer
    val email: String? = null,
    val avatarUrl: String? = null,
    val passkeyCredential: PasskeyCredential? = null,  // max. ein Passkey pro User
)
```

`githubId` ist nullable – Passkey-only-Nutzer benötigen keinen GitHub-Account.
Bestehende Einträge in `users.json` sind rückwärtskompatibel (Jackson → `null`).

`passkeyCredential` (singular, nullable) ersetzt eine Liste: pro User ist genau ein
Passkey registriert. Ein erneutes Registrieren überschreibt den vorhandenen Eintrag.
Wird von Jackson automatisch in `users.json` mitgespeichert – **kein neues
Persistence-File** nötig.

### 3. `UserWritePort.kt` – `findById` ergänzen

```kotlin
interface UserWritePort {
    fun findByGithubId(githubId: String): UserRecord?
    fun findByUsername(username: String): UserRecord?
    fun findById(id: String): UserRecord?   // neu
    fun save(user: UserRecord)
}
```

### 4. `JsonUserRepository.kt` – Implementierung

```kotlin
override fun findById(id: String): UserRecord? = store.users[id]
```

### 5. `WebAuthnController.kt` *(neu)*

Datei: `adapter/in/web/WebAuthnController.kt`

#### Challenge-Cache

```kotlin
private data class ChallengeEntry(val challenge: ByteArray, val username: String?, val createdAt: Long)
private val pendingChallenges = ConcurrentHashMap<String, ChallengeEntry>()
private val CHALLENGE_TTL_MS = 5 * 60 * 1_000L   // 5 Minuten
```

Expired Entries werden bei jedem Request bereinigt (lazy GC reicht für diesen Use-Case).

#### Endpoints

| Methode | Pfad | Body | Beschreibung |
|---|---|---|---|
| `POST` | `/api/auth/webauthn/register/start` | `{ username: String }` | Erzeugt Challenge + `PublicKeyCredentialCreationOptions` |
| `POST` | `/api/auth/webauthn/register/finish` | WebAuthn Attestation Response | Validiert, legt `UserRecord` an oder hängt Credential an, gibt `AuthResponse` zurück |
| `POST` | `/api/auth/webauthn/authenticate/start` | `{ username: String? }` (optional) | Gibt `PublicKeyCredentialRequestOptions` zurück (Discoverable Credentials wenn kein Username) |
| `POST` | `/api/auth/webauthn/authenticate/finish` | WebAuthn Assertion Response | Validiert Assertion, aktualisiert `signCount`, gibt `AuthResponse` zurück |

#### Ablauf Registrierung

1. Client sendet `{ username }`.
2. Server prüft: Username bereits vergeben? → `400 Bad Request`.
3. Challenge erzeugen (`SecureRandom`, 32 Bytes), Base64url-kodieren, im Cache speichern.
4. `PublicKeyCredentialCreationOptions` zusammenbauen:
   - `rp: { id, name }` aus Config
   - `user: { id (UUID), name, displayName }`
   - `challenge`
   - `pubKeyCredParams: [{ alg: -7 (ES256), type: "public-key" }, { alg: -257 (RS256), type: "public-key" }]`
   - `authenticatorSelection: { userVerification: "preferred", residentKey: "preferred" }`
   - `timeout: 60_000`
5. JSON-Response an Client.

#### Ablauf Authentifizierung

1. Client sendet optional `{ username }`.
2. `allowCredentials` = bekannte Credential-IDs des Users (leer wenn kein Username → Discoverable).
3. Challenge erzeugen, im Cache speichern.
4. `PublicKeyCredentialRequestOptions` zurückgeben.

#### Finish-Endpoints (beide)

Validierung mit `webauthn-server-core`:
- Signature verifizieren
- Origin & rpIdHash prüfen
- `signCount` gegen gespeicherten Wert prüfen (Replay-Schutz)
- Bei Erfolg: `UserRecord` anlegen / aktualisieren, JWT via `JwtTokenProvider.generateToken(username)` erzeugen, `AuthResponse` zurückgeben.

### 6. `SecurityConfig.kt` – neue Matcher freigeben

`/api/auth/**` schließt `/api/auth/webauthn/**` bereits ein –
**keine Änderung an `SecurityConfig.kt` nötig**.

### 7. `application.yml`

```yaml
landmarks:
  webauthn:
    rp-id:   ${LANDMARKS_WEBAUTHN_RP_ID:localhost}
    rp-name: ${LANDMARKS_WEBAUTHN_RP_NAME:Landmarks}
    origin:  ${LANDMARKS_WEBAUTHN_ORIGIN:http://localhost:5173}
```

---

## Client (`client`)

### 8. `api/mapApi.ts` – vier neue Funktionen

```typescript
// Helper: ArrayBuffer ↔ Base64url
function bufferToBase64url(buf: ArrayBuffer): string { … }
function base64urlToBuffer(b64: string): ArrayBuffer { … }

export async function webauthnRegisterStart(username: string): Promise<PublicKeyCredentialCreationOptionsJSON> { … }
export async function webauthnRegisterFinish(username: string, cred: PublicKeyCredential): Promise<AuthResponse> { … }
export async function webauthnAuthStart(username?: string): Promise<PublicKeyCredentialRequestOptionsJSON> { … }
export async function webauthnAuthFinish(cred: PublicKeyCredential): Promise<AuthResponse> { … }
```

`PublicKeyCredentialCreationOptionsJSON` / `PublicKeyCredentialRequestOptionsJSON` sind
die Browser-nativen Typen (TypeScript `lib.dom.d.ts` enthält sie ab TS 5.1).

Die Funktionen serialisieren alle `ArrayBuffer`-Felder zu/von Base64url, bevor sie
mit dem Server kommunizieren.

### 9. `AuthPage.tsx` – Passkey-Button mit Feature-Detection

```tsx
const webAuthnSupported = typeof window !== 'undefined' && !!window.PublicKeyCredential;

// Nur rendern wenn unterstützt:
{webAuthnSupported && (
  <Button onClick={handlePasskeyClick} …>
    🔑 Sign in with Passkey
  </Button>
)}
```

#### UX-Flow (ein Button für Login + Registrierung)

1. Click → `webauthnAuthStart()` (kein Username → Discoverable Credential).
2. Browser-Dialog: Nutzer wählt gespeicherten Passkey → `webauthnAuthFinish()` → Login
   erfolgreich → `/lobby`.
3. Schlägt `authenticate/start` fehl weil kein Credential bekannt oder User bricht ab:
   → Inline-Modal erscheint mit **Username-Eingabe** + zwei Buttons:
   „Register new Passkey" / „Sign in with username".
4. **Register**: `webauthnRegisterStart(username)` → `navigator.credentials.create()` →
   `webauthnRegisterFinish()` → `authLogin()` → `/lobby`.
5. **Sign in with username**: `webauthnAuthStart(username)` → `navigator.credentials.get()` →
   `webauthnAuthFinish()` → `authLogin()` → `/lobby`.

Fehlerbehandlung: Browser-Abbruch (`NotAllowedError`) wird still ignoriert (kein Error-Banner);
Server-Fehler werden als Alert gezeigt.

---

## Datenfluss (Sequenz)

```
Browser                          Server
  │                                │
  │── POST /register/start ────────▶│ Challenge erzeugen, im Cache speichern
  │◀── CreationOptions + challenge ─│
  │                                │
  │── navigator.credentials.create()
  │   (Browser-Biometrie-Dialog)   │
  │                                │
  │── POST /register/finish ───────▶│ Attestation validieren
  │                                │  UserRecord anlegen
  │                                │  JWT erzeugen
  │◀── AuthResponse(token, …) ─────│
  │── authLogin() → /lobby         │
```

```
Browser                          Server
  │                                │
  │── POST /authenticate/start ───▶│ Challenge erzeugen
  │◀── RequestOptions + challenge ─│
  │                                │
  │── navigator.credentials.get()
  │   (Browser-Biometrie-Dialog)   │
  │                                │
  │── POST /authenticate/finish ──▶│ Assertion validieren
  │                                │  signCount aktualisieren
  │                                │  JWT erzeugen
  │◀── AuthResponse(token, …) ─────│
  │── authLogin() → /lobby         │
```

---

## Sicherheitshinweise

| Thema | Maßnahme |
|---|---|
| Challenge-TTL | 5 Minuten; abgelaufene Entries werden lazy bereinigt |
| Replay-Schutz | `signCount` wird nach jeder Authentifizierung gespeichert und geprüft |
| Origin-Binding | Server prüft `origin` und `rpIdHash` in jedem Finish-Request |
| `githubId` nullable | Passkey-only-Nutzer haben kein `githubId`; bestehende GitHub-Nutzer behalten es |
| HTTPS in Prod | WebAuthn funktioniert **nur** auf `localhost` oder HTTPS; `rpId` muss der Hostname sein |

---

## Tests

### 10. Server – `WebAuthnControllerTest.kt` *(neu)*

Datei: `adapter/in/web/WebAuthnControllerTest.kt`  
Stil: Unit-Tests mit Mockito-Kotlin, kein Spring-Context (wie `GitHubOAuthControllerTest`).

| Test | Beschreibung |
|---|---|
| `register/start returns 400 when username is blank` | Leerer/fehlender Username → 400 |
| `register/start returns 400 when username already taken` | `findByUsername` findet Eintrag → 400 |
| `register/start returns creation options with challenge` | Neue Challenge im Cache; Response enthält `challenge`, `rp.id`, `user.name` |
| `register/finish returns 401 when challenge not found` | Unbekannte `sessionId` → 401 |
| `register/finish returns 401 when challenge is expired` | `createdAt` älter als TTL → 401 |
| `register/finish returns 401 when attestation signature invalid` | `webauthn-server-core` wirft Exception → 401 |
| `register/finish creates new UserRecord and returns JWT` | Valide Attestation → `save()` aufgerufen, `AuthResponse` mit Token |
| `authenticate/start returns request options for known username` | `allowCredentials` enthält `credentialId` des gespeicherten Passkeys |
| `authenticate/start returns empty allowCredentials when no username given` | Discoverable-Flow |
| `authenticate/start returns 404 when username unknown` | User nicht gefunden → 404 |
| `authenticate/finish returns 401 when challenge not found` | Unbekannte `sessionId` → 401 |
| `authenticate/finish returns 401 when assertion signature invalid` | Validierungsfehler → 401 |
| `authenticate/finish returns JWT and updates signCount` | Valide Assertion → `save()` mit erhöhtem `signCount`, `AuthResponse` zurück |
| `authenticate/finish returns 401 when signCount not greater than stored` | Replay-Angriff erkannt → 401 |

### 11. Server – `WebAuthnChallengeStoreTest.kt` *(optional, bei Extraktion in eigene Klasse)*

| Test | Beschreibung |
|---|---|
| `store returns null for unknown key` | Miss-Lookup |
| `store returns entry for known key` | Hit-Lookup |
| `store removes expired entries on next access` | TTL-Cleanup läuft lazy |
| `store removes entry after consume` | Challenge nach Einlösung gelöscht (Einmal-Nutzung) |

### 12. Client – `AuthPage.test.tsx` *(erweitern)*

Stil: Vitest + Testing Library (wie `LobbyPage.test.tsx`).

```typescript
vi.mock('../api/mapApi');
```

| Test | Beschreibung |
|---|---|
| `Passkey button not rendered when PublicKeyCredential undefined` | `window.PublicKeyCredential = undefined` vor Render → Button nicht im DOM |
| `Passkey button rendered when PublicKeyCredential defined` | `window.PublicKeyCredential = class {}` → Button sichtbar |
| `clicking Passkey button triggers webauthnAuthStart` | `webauthnAuthStart` gemockt → wird mit `undefined` aufgerufen |
| `successful auth flow calls authLogin and navigates to /lobby` | `webauthnAuthStart` + `webauthnAuthFinish` erfolgreich → `authLogin` aufgerufen, Route `/lobby` |
| `failed discoverable auth shows username modal` | `webauthnAuthStart` wirft `NotAllowedError` → Modal mit Username-Input sichtbar |
| `register flow: submit username calls webauthnRegisterStart` | Username eingeben, „Register new Passkey" klicken → `webauthnRegisterStart(username)` aufgerufen |
| `register flow: successful registration navigates to /lobby` | Vollständiger Register-Flow → `authLogin` + `/lobby` |
| `server error shows alert` | `webauthnRegisterFinish` wirft Error → Alert mit Fehlermeldung |
| `GitHub button still visible alongside Passkey button` | Beide Buttons gleichzeitig im DOM |

### 13. Client – `mapApi.webauthn.test.ts` *(neu)*

Testet die Base64url-Hilfsfunktionen und HTTP-Aufrufe isoliert.

| Test | Beschreibung |
|---|---|
| `bufferToBase64url round-trips with base64urlToBuffer` | Hin- und Rückkonvertierung identisch |
| `webauthnRegisterStart sends POST to /api/auth/webauthn/register/start` | `fetch` gemockt → korrekte URL + Body |
| `webauthnAuthStart sends POST with username when provided` | Body enthält `{ username }` |
| `webauthnAuthStart sends POST without username when omitted` | Body enthält `{}` oder `{ username: null }` |
| `webauthnAuthFinish serialises ArrayBuffer fields to Base64url` | `response.id`, `response.rawId` korrekt kodiert |

---

## Betroffene Dateien (Übersicht)

| Datei | Änderung |
|---|---|
| `server/pom.xml` | `webauthn-server-core` Dependency hinzufügen |
| `server/src/main/resources/application.yml` | `landmarks.webauthn.*` Konfiguration |
| `server/.../adapter/out/repository/UserRecord.kt` | `PasskeyCredential` data class; `passkeyCredential: PasskeyCredential? = null`; `githubId` → nullable |
| `server/.../application/port/UserWritePort.kt` | `findById()` hinzufügen |
| `server/.../adapter/out/persistence/JsonUserRepository.kt` | `findById()` implementieren |
| `server/.../adapter/in/web/WebAuthnController.kt` | *(neu)* alle 4 Endpoints + Challenge-Cache |
| `server/.../adapter/in/web/security/SecurityConfig.kt` | Kein Change nötig – `/api/auth/**` deckt WebAuthn bereits ab |
| `client/src/api/mapApi.ts` | 4 WebAuthn-Funktionen + Base64url-Helper |
| `client/src/pages/AuthPage/AuthPage.tsx` | Passkey-Button mit `window.PublicKeyCredential`-Guard + Inline-Modal |
| `server/.../adapter/in/web/WebAuthnControllerTest.kt` | *(neu)* Unit-Tests Controller + Challenge-Cache |
| `client/src/test/AuthPage.test.tsx` | *(neu/erweitern)* Feature-Detection, Register- und Auth-Flow |
| `client/src/test/mapApi.webauthn.test.ts` | *(neu)* Base64url-Helper + HTTP-Aufrufe |

---

## Entscheidungen

- **`githubId` nullable** ✅: `githubId` wird von `String` (Pflicht) auf `String? = null`
  geändert. Passkey-only-Nutzer haben kein `githubId`. Bestehende `users.json`-Einträge
  bleiben kompatibel – Jackson deserialisiert fehlende Felder problemlos als `null`.
  **Keine Datenmigration nötig.**

- **Ein Passkey pro User** ✅: `passkeyCredentials` wird als einzelnes Feld
  `passkeyCredential: PasskeyCredential? = null` modelliert (kein `List`).
  Beim Registrieren wird ein vorhandener Passkey stillschweigend überschrieben.
  Das vereinfacht `register/finish` (kein Duplikat-Check) und `authenticate/start`
  (genau ein `allowCredentials`-Eintrag wenn vorhanden).

  ```kotlin
  data class UserRecord(
      val id: String,
      val username: String,
      val githubId: String? = null,
      val email: String? = null,
      val avatarUrl: String? = null,
      val passkeyCredential: PasskeyCredential? = null,
  )
  ```

- **Discoverable Credentials**: Wenn der Browser keinen Passkey für die `rpId` kennt,
  schlägt `authenticate/start` (leeres `allowCredentials`) fehl – der UX-Fallback
  zeigt dann das Username-Modal. Alternativ könnte direkt das Modal gezeigt werden.

---

## Nachträgliche Fixes (Security-Audit, 2026-04-11)

### Fix 1 – Yubico-Library statt Hand-Krypto (Refactoring)

**Problem:** Der erste Entwurf von `WebAuthnController.kt` hat `webauthn-server-core`
als Dependency deklariert, aber **nicht benutzt**. Stattdessen wurden ~250 Zeilen
manueller Byte-Code geschrieben:

| Handgeschriebener Code | Risiko |
|---|---|
| Eigener CBOR-Parser (`extractAuthDataFromCbor`) | Funktioniert nur für `fmt = "none"`, bricht bei `packed`, `tpm`, `apple` |
| COSE→EC-PublicKey Dekodierung (`decodeCosePublicKey`) | Nur ES256, kein RS256 trotz ausgegebener Param |
| clientDataJSON Regex-Parser (`parseClientDataJson`) | Bricht bei Unicode/Escape-Sequenzen |
| rpIdHash-Verifikation / Signaturverifikation | Reimplementierung von Spec-Schritten – fehleranfällig |

**Fix:** Controller komplett auf Yubico `RelyingParty` API umgestellt:

- `RelyingParty.startRegistration()` / `finishRegistration()` ersetzen CBOR/PK-Logik
- `RelyingParty.startAssertion()` / `finishAssertion()` ersetzen clientData/rpIdHash/Signaturprüfung
- Neues `YubicoCredentialRepository.kt` brückt `CredentialRepository` → `UserWritePort`
- Controller von 527 → 360 Zeilen, kein Byte-Handling mehr

### Fix 2 – Race-Condition: Account-Übernahme via `registerFinish` (🔴 Kritisch)

**Problem:** `registerStart` prüfte `findByUsername(username) != null` → lehnte ab wenn
vergeben. Aber `registerFinish` prüfte **nicht erneut** und machte:

```kotlin
val existing = userRepository.findByUsername(pending.pendingUsername)
val userRecord = existing?.copy(passkeyCredential = credential) ?: UserRecord(…)
```

Wenn zwischen `start` und `finish` (bis 5 Min.) ein anderer Nutzer denselben Username
via GitHub-OAuth oder parallelen WebAuthn-Flow registrierte, wurde dessen Passkey
**überschrieben** – vollständige Account-Übernahme.

**Fix:** `registerFinish` prüft erneut `findByUsername()` und gibt **409 Conflict**
zurück statt den bestehenden Account zu überschreiben:

```kotlin
val existing = userRepository.findByUsername(pending.pendingUsername)
if (existing != null) return ResponseEntity.status(409).build()
```

### Fix 3 – JSON-Injection in `buildRegistrationJson` / `buildAssertionJson` (🔴 Kritisch)

**Problem:** User-Strings (`req.id`, `req.type`, `req.rawId`) wurden direkt in
JSON-String-Templates interpoliert:

```kotlin
"""{"type":"${req.type}","id":"${req.id}",…}"""
```

Ein `id`-Feld mit `"` konnte beliebige JSON-Felder injizieren und die Yubico-Library
mit manipulierten Daten füttern.

**Fix:** Jackson `ObjectMapper.writeValueAsString()` für sichere Serialisierung:

```kotlin
private val objectMapper = ObjectMapper()

private fun buildRegistrationJson(req: RegisterFinishRequest): String {
    val map = mapOf("type" to req.type, "id" to req.id, "rawId" to req.rawId, …)
    return objectMapper.writeValueAsString(map)
}
```

### Fix 4 – Username-Validierung + Case-Normalisierung (🟡 Mittel)

**Problem:** Beliebige Strings (HTML, Control-Chars, 10.000+ Zeichen) wurden als
Username akzeptiert. `"Alice"` und `"alice"` waren verschiedene User – ermöglichte
Impersonation.

**Fix:**
- Username wird in `registerStart` auf `trim().lowercase()` normalisiert
- Regex-Pattern erlaubt nur `[a-z0-9._-]`, 1–39 Zeichen, muss mit Alphanumeric
  beginnen/enden (kompatibel mit GitHub-Login-Regeln):

```kotlin
companion object {
    val USERNAME_PATTERN = Regex("^[a-z0-9](?:[a-z0-9._-]{0,37}[a-z0-9])?\$")
}
```

- `JsonUserRepository.findByUsername()` vergleicht jetzt `ignoreCase = true`

### Fix 5 – GitHub/WebAuthn Username-Kollision (🟡 Mittel)

**Problem:** `GitHubOAuthService.upsertUser()` verwendete `info.login` direkt als
Username ohne Kollisionsprüfung. Ein GitHub-Login `"alice"` und ein WebAuthn-User
`"alice"` erzeugten separate `UserRecord`s mit gleichem `username` → da JWT nur
auf `username` basiert, waren beide Identitäten austauschbar.

**Fix:** `upsertUser()` prüft `findByUsername()` und hängt bei Kollision ein
Suffix an (`-1`, `-2`, …):

```kotlin
var candidate = info.login.lowercase()
var suffix = 1
while (userRepository.findByUsername(candidate) != null) {
    candidate = "${info.login.lowercase()}-$suffix"
    suffix++
}
```

### Neue/Erweiterte Tests

| Test | Datei | Beschreibung |
|---|---|---|
| `register start returns 400 for invalid username with special chars` | `WebAuthnControllerTest.kt` | `bob@evil` → 400 |
| `register start returns 400 for username with spaces` | `WebAuthnControllerTest.kt` | `bob smith` → 400 |
| `register start returns 400 for username exceeding max length` | `WebAuthnControllerTest.kt` | 40 chars → 400 |
| `register start normalises username to lowercase` | `WebAuthnControllerTest.kt` | `BoB` → `bob` in Response |
| `username pattern accepts valid usernames` | `WebAuthnControllerTest.kt` | `a`, `alice-bob`, `alice.bob`, `a1`, 39 chars |
| `username pattern rejects invalid usernames` | `WebAuthnControllerTest.kt` | Leer, `-alice`, `alice-`, Leerzeichen, `@`, `<script>`, Uppercase, 40 chars |

### Betroffene Dateien (Fixes)

| Datei | Änderung |
|---|---|
| `server/.../adapter/in/web/WebAuthnController.kt` | Yubico-Library nutzen; Race-Condition fix; JSON-Injection fix; Username-Validierung |
| `server/.../adapter/out/repository/YubicoCredentialRepository.kt` | *(neu)* Brücke `CredentialRepository` → `UserWritePort` |
| `server/.../adapter/in/web/GitHubOAuthService.kt` | Username-Kollisionsprüfung + Lowercase |
| `server/.../adapter/out/persistence/JsonUserRepository.kt` | `findByUsername` case-insensitive |
| `server/.../adapter/in/web/WebAuthnControllerTest.kt` | 6 neue Tests (Username-Validierung + Pattern) |

