package team.dedica.porthole.config

/**
 * Test factory for [PortholeAuthProperties].
 * Provides sensible defaults for all required fields so tests only need to
 * override the values they actually care about.
 */
object PortholeAuthPropertiesTestFactory {

    fun build(
        cookie: PortholeAuthProperties.Cookie = PortholeAuthProperties.Cookie(),
        allowedOrigins: String = "http://localhost:5173",
        github: PortholeAuthProperties.GitHub = PortholeAuthProperties.GitHub(),
        keycloak: PortholeAuthProperties.Keycloak = PortholeAuthProperties.Keycloak(),
        webauthn: PortholeAuthProperties.WebAuthn = PortholeAuthProperties.WebAuthn(),
        tagline: String = "for teams",
    ) = PortholeAuthProperties().apply {
        this.cookie = cookie
        this.allowedOrigins = allowedOrigins
        this.github = github
        this.keycloak = keycloak
        this.webauthn = webauthn
        this.tagline = tagline
    }

    /** Convenience: WebAuthn enabled with the given rp-id. */
    fun withWebAuthn(
        rpId: String = "localhost",
        rpName: String = "Landmarks Test",
        origin: String = "http://localhost:5173",
    ) = build(
        webauthn = PortholeAuthProperties.WebAuthn().apply {
            this.rpId = rpId
            this.rpName = rpName
            this.origin = origin
        }
    )

    /** Convenience: GitHub enabled with the given client-id. */
    fun withGitHub(
        clientId: String = "test-github-client-id",
        clientSecret: String = "test-github-client-secret",
        redirectUri: String = "http://localhost:5173/auth/github/callback",
    ) = build(
        github = PortholeAuthProperties.GitHub().apply {
            this.clientId = clientId
            this.clientSecret = clientSecret
            this.redirectUri = redirectUri
        }
    )
}
