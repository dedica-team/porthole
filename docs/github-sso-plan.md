# Plan: GitHub SSO Integration

> Erstellt: 2026-03-07
> Status: ✅ vollständig implementiert

## Konzept

GitHub ist der **einzige** Authentifizierungsweg. Der bestehende Username/Password-Login (Register + Login) wird vollständig entfernt. Der Nutzer klickt auf der `AuthPage` den **„Login with GitHub"**-Button, wird zu GitHub weitergeleitet, autorisiert die App und landet nach dem Callback automatisch im Spiel. Serverseitig verarbeitet ein Callback-Endpoint den OAuth-Code, legt den GitHub-User als `UserRecord` an (oder aktualisiert ihn) und gibt das gewohnte JWT zurück.

Die GitHub-E-Mail ist optional – fehlt sie, wird `null` gespeichert.

---

## Voraussetzungen

### GitHub OAuth App anlegen

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
2. Felder:
   - **Application name:** `Landmarks`
   - **Homepage URL:** abhängig von der Umgebung (z. B. `http://localhost:5173` lokal)
   - **Authorization callback URL:** abhängig von der Umgebung (z. B. `http://localhost:8080/api/auth/github/callback` lokal)
3. Nach der Erstellung: **Client ID** und **Client Secret** notieren.
4. Für jede Umgebung (lokal, Staging, Produktion) eine eigene OAuth App anlegen oder mehrere Callback-URLs in einer App registrieren.

---

## Server (`server`)

### 1. Maven-Dependency hinzufügen – `pom.xml` ✅

`spring-security-oauth2-client` wird benötigt. Spring Boot verwaltet die Version automatisch:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-oauth2-client</artifactId>
</dependency>
```

### 2. Konfiguration – `application.yml` ✅

```yaml
spring:
  security:
    oauth2:
      client:
        registration:
          github:
            client-id: ${GITHUB_CLIENT_ID}
            client-secret: ${GITHUB_CLIENT_SECRET}
            scope: read:user, user:email
        provider:
          github:
            authorization-uri: https://github.com/login/oauth/authorize
            token-uri: https://github.com/login/oauth/access_token
            user-info-uri: https://api.github.com/user
            user-name-attribute: login
```

`GITHUB_CLIENT_ID` und `GITHUB_CLIENT_SECRET` werden als Umgebungsvariablen gesetzt (nie im Repository).

### 3. `domain/UserRecord.kt` – umschreiben ✅

`passwordHash` entfällt vollständig. Neu: optionales `email`-Feld (GitHub-E-Mail, Fallback `null`):

```kotlin
data class UserRecord(
    val id: String,
    val username: String,
    val githubId: String,               // GitHub User-ID (numerisch als String), Pflichtfeld
    val email: String? = null           // GitHub-E-Mail, kann null sein
)
```

### 4. `application/port/UserWritePort.kt` – auf GitHub-Lookup reduzieren ✅

`existsByUsername` und `save` mit `passwordHash` entfallen. Die Schnittstelle wird auf das Wesentliche reduziert:

```kotlin
interface UserWritePort {
    fun findByGithubId(githubId: String): UserRecord?
    fun findByUsername(username: String): UserRecord?
    fun save(user: UserRecord)
}
```

`UserPort.kt` (bisheriger Basis-Port) kann ebenfalls bereinigt oder entfernt werden, da `findByUsername` künftig in `UserWritePort` lebt.

### 5. `adapter/in/web/AuthController.kt` – **entfernen** ✅

Die bisherigen Endpoints `/api/auth/register` und `/api/auth/login` sowie `PasswordEncoder` werden vollständig gelöscht. `SecurityConfig` verliert die `BCryptPasswordEncoder`-Bean.

### 6. `adapter/in/web/GitHubOAuthController.kt` *(neu)* ✅

Dieser Controller übernimmt den OAuth-Callback manuell, um vollständige Kontrolle über User-Anlage und JWT-Ausgabe zu behalten.

```
POST /api/auth/github/callback?code=...
```

Ablauf:
1. `code` gegen GitHub-Token-Endpoint eintauschen. Client-ID und Secret kommen aus `application.yml` (Umgebungsvariablen – nie hardcoded).
2. Mit Access-Token die GitHub User-Info (`https://api.github.com/user`) abrufen.
3. Optionaler zweiter Aufruf von `https://api.github.com/user/emails` für die primäre E-Mail (Scope `user:email`). Schlägt er fehl oder ist die E-Mail nicht verfügbar → `null`.
4. `githubId` in `UserRecord` suchen → gefunden: bestehenden User nutzen (E-Mail ggf. aktualisieren).
5. Nicht gefunden → neuen `UserRecord` anlegen (`id = UUID`, `githubId` gesetzt, `username = github.login`, `email = null | adresse`).
6. JWT mit `JwtTokenProvider.generateToken(username)` erzeugen.
7. `AuthResponse(token, userId, username)` zurückgeben – identisches Format wie bisher.

### 7. `SecurityConfig.kt` – Callback-Endpoint freigeben ✅

```kotlin
it.requestMatchers("/api/auth/**").permitAll()
```

Dieser Matcher schließt `/api/auth/github/callback` bereits ein – **keine Änderung nötig**.

OAuth2-Login-Redirect über Spring Security wird **nicht** verwendet (kein `oauth2Login {}`), da wir den Callback selbst verwalten und JWT statt einer Session ausgeben.

---

## Client (`client`)

### 8. `api/mapApi.ts` – Auth-Funktionen ersetzen ✅

`register()` und `login()` werden entfernt. Stattdessen kommt `githubCallback`:

```typescript
export async function githubCallback(code: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}/auth/github/callback?code=${encodeURIComponent(code)}`, {
    method: 'POST',
  });
  return handleResponse<AuthResponse>(res);
}
```

### 9. `pages/AuthPage/AuthPage.tsx` – auf „Login with GitHub"-Button reduzieren ✅

Username/Password-Formular und Register/Login-Tabs werden entfernt. Die Seite zeigt nur noch:

```tsx
const GITHUB_AUTH_URL = import.meta.env.VITE_GITHUB_AUTH_URL as string;

// ...

<a href={GITHUB_AUTH_URL} className={styles.githubButton}>
  <GitHubIcon /> Login with GitHub
</a>
```

`VITE_GITHUB_AUTH_URL` enthält die vollständige Authorization-URL inklusive `client_id`, `scope` und `state` und wird pro Umgebung in `.env.local` / der CI-Konfiguration gesetzt – nie hardcoded im Code:

```dotenv
# .env.local (Entwicklung)
VITE_GITHUB_AUTH_URL=https://github.com/login/oauth/authorize?client_id=<dev-client-id>&scope=read:user,user:email
```

### 10. `pages/AuthPage/GitHubCallbackPage.tsx` *(neu)* ✅

Eigenständige Route `/auth/github/callback`, die nach der GitHub-Weiterleitung aufgerufen wird:

1. `code`- und `state`-Parameter aus `window.location.search` lesen.
2. `state` gegen den in `sessionStorage` gespeicherten Wert prüfen (CSRF-Schutz).
3. `githubCallback(code)` aufrufen.
4. Bei Erfolg: `authLogin(token, userId, username)` + `navigate('/lobby')`.
5. Bei Fehler: Fehlermeldung anzeigen + Link zurück zur `AuthPage`.

### 11. `App.tsx` – neue Route ✅

```tsx
<Route path="/auth/github/callback" element={<GitHubCallbackPage />} />
```

Diese Route muss **außerhalb** der `ProtectedRoute` liegen.

### 12. `.env.local` (nicht committen) ✅

```dotenv
VITE_GITHUB_AUTH_URL=https://github.com/login/oauth/authorize?client_id=<dev-client-id>&scope=read:user,user:email
```

---

## Datenfluss (Sequenz)

```
Browser                  GitHub                   Server
  │                         │                        │
  │── click "Login w/ GH" ──▶                        │
  │       redirect           │                        │
  │◀──────────────────────── │ authorize              │
  │                         │                        │
  │── POST /api/auth/github/callback?code=XYZ ───────▶│
  │                         │                        │── exchange code for token
  │                         │◀──────────────────── ──│── GET /user
  │                         │──── user info ─────────▶│
  │                         │                        │── upsert UserRecord
  │                         │                        │── generateToken()
  │◀─────────────────────── AuthResponse(JWT) ────────│
  │── store token, navigate /lobby                    │
```

---

## Sicherheitshinweise

| Thema | Maßnahme |
|---|---|
| `state`-Parameter | CSRF-Schutz: Vor dem Redirect einen zufälligen `state`-Wert in `sessionStorage` speichern und nach dem Callback prüfen. |
| Client Secret | **Niemals** im Frontend oder im Repository. Nur als serverseitige Umgebungsvariable. |
| Token-Scope | Nur `read:user` und `user:email` anfordern – minimale Berechtigungen. |
| HTTPS | In Produktion ausschließlich HTTPS; Callback-URL muss HTTPS sein. |

---

## Betroffene Dateien (Übersicht)

| Datei | Änderung |
|---|---|
| `server/pom.xml` | `spring-boot-starter-oauth2-client` hinzufügen |
| `server/src/main/resources/application.yml` | OAuth2-Client-Konfiguration (URLs aus Umgebungsvariablen) |
| `server/.../domain/UserRecord.kt` | `passwordHash` entfernen, `githubId: String` (Pflicht), `email: String?` hinzufügen |
| `server/.../application/port/UserPort.kt` | Entfernen oder in `UserWritePort` aufgehen lassen |
| `server/.../application/port/UserWritePort.kt` | Auf `findByGithubId`, `findByUsername`, `save` reduzieren |
| `server/.../adapter/in/web/AuthController.kt` | **Entfernen** |
| `server/.../adapter/in/web/GitHubOAuthController.kt` | *(neu)* Callback-Endpoint |
| `server/.../adapter/in/web/security/SecurityConfig.kt` | `BCryptPasswordEncoder`-Bean entfernen |
| `server/.../adapter/out/repository/UserRepository.kt` | `githubId`-Feld persistieren, `passwordHash` entfernen |
| `client/src/api/mapApi.ts` | `register()`/`login()` entfernen, `githubCallback()` hinzufügen |
| `client/src/pages/AuthPage/AuthPage.tsx` | Formular entfernen, nur GitHub-Button |
| `client/src/pages/AuthPage/GitHubCallbackPage.tsx` | *(neu)* Callback-Seite |
| `client/src/App.tsx` | Route `/auth/github/callback` hinzufügen |
| `client/.env.local` | `VITE_GITHUB_AUTH_URL` (vollständige Auth-URL je Umgebung) |

---

## Offene Entscheidungen

- **E-Mail:** `user:email`-Scope wird angefordert; ist die E-Mail nicht vorhanden oder nicht öffentlich, wird `null` gespeichert – kein Blocking.
- **Produktions-Konfiguration:** `VITE_GITHUB_AUTH_URL` und `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` müssen in der CI/CD-Pipeline pro Umgebung gesetzt werden. Separate GitHub OAuth Apps je Umgebung sind empfohlen.

