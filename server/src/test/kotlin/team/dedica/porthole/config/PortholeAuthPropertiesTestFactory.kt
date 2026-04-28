package team.dedica.porthole.config

/**
 * Test factory for [PortholeAuthProperties].
 * Provides sensible defaults for all required fields so tests only need to
 * override the values they actually care about.
 */
object PortholeAuthPropertiesTestFactory {

    val DEFAULT_JWT = PortholeAuthProperties.Jwt(
        secret = "test-secret-key-for-unit-tests-only-do-not-use-in-production-256bit!!",
        expirationMs = 3_600_000L,
        issuer = "porthole-test",
        audience = "porthole-test-api",
    )

    fun build(
        cookie: PortholeAuthProperties.Cookie = PortholeAuthProperties.Cookie(),
        jwt: PortholeAuthProperties.Jwt = DEFAULT_JWT,
        allowedOrigins: String = "http://localhost:5173",
        github: PortholeAuthProperties.GitHub = PortholeAuthProperties.GitHub(),
        keycloak: PortholeAuthProperties.Keycloak = PortholeAuthProperties.Keycloak(),
        webauthn: PortholeAuthProperties.WebAuthn = PortholeAuthProperties.WebAuthn(),
    ) = PortholeAuthProperties(
        cookie = cookie,
        jwt = jwt,
        allowedOrigins = allowedOrigins,
        github = github,
        keycloak = keycloak,
        webauthn = webauthn,
    )

    /** Convenience: custom JWT settings. */
    fun withJwt(
        secret: String = DEFAULT_JWT.secret,
        expirationMs: Long = DEFAULT_JWT.expirationMs,
        issuer: String = DEFAULT_JWT.issuer,
        audience: String = DEFAULT_JWT.audience,
    ) = build(jwt = PortholeAuthProperties.Jwt(secret = secret, expirationMs = expirationMs, issuer = issuer, audience = audience))

    /** Convenience: WebAuthn enabled with the given rp-id. */
    fun withWebAuthn(
        rpId: String = "localhost",
        rpName: String = "Landmarks Test",
        origin: String = "http://localhost:5173",
    ) = build(webauthn = PortholeAuthProperties.WebAuthn(rpId = rpId, rpName = rpName, origin = origin))

    /** Convenience: GitHub enabled with the given client-id. */
    fun withGitHub(
        clientId: String = "test-github-client-id",
        clientSecret: String = "test-github-client-secret",
        redirectUri: String = "http://localhost:5173/auth/github/callback",
    ) = build(github = PortholeAuthProperties.GitHub(clientId = clientId, clientSecret = clientSecret, redirectUri = redirectUri))
}

