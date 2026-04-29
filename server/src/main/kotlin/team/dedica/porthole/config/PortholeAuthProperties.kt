package team.dedica.porthole.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.bind.DefaultValue

@ConfigurationProperties(prefix = "porthole.auth")
class PortholeAuthProperties(
    var cookie: Cookie = Cookie(),
    var jwt: Jwt,
    @DefaultValue("http://localhost:5173,http://localhost:8080")
    var allowedOrigins: String = "http://localhost:5173,http://localhost:8080",
    var github: GitHub = GitHub(),
    var keycloak: Keycloak = Keycloak(),
    var webauthn: WebAuthn = WebAuthn(),
    @DefaultValue("for teams") var tagline: String = "for teams",
) {
    class Cookie(
        @DefaultValue("porthole_auth") var cookieName: String = "porthole_auth",
        @DefaultValue("/") var cookiePath: String = "/",
        @DefaultValue("Lax") var cookieSameSite: String = "Lax",
        @DefaultValue("false") var cookieSecure: Boolean = false,
    )

    class Jwt(
        var secret: String,
        @DefaultValue("86400000") var expirationMs: Long = 86_400_000L,
        @DefaultValue("porthole") var issuer: String = "porthole",
        @DefaultValue("porthole-api") var audience: String = "porthole-api",
    ) {
        companion object {
            const val INSECURE_DEFAULT = "change-me-in-production-this-is-not-a-real-secret!!"
        }

        fun isUsingDefaultSecret(): Boolean = secret.trim() == INSECURE_DEFAULT
    }

    class GitHub(
        @DefaultValue("") var clientId: String = "",
        @DefaultValue("") var clientSecret: String = "",
        @DefaultValue("http://localhost:5173/auth/github/callback")
        var redirectUri: String = "http://localhost:5173/auth/github/callback",
    ) {
        fun isEnabled(): Boolean = clientId.isNotBlank() && clientSecret.isNotBlank()
    }

    class Keycloak(
        @DefaultValue("") var clientId: String = "",
        @DefaultValue("") var clientSecret: String = "",
        @DefaultValue("") var issuerUri: String = "",
        @DefaultValue("http://localhost:5173/auth/keycloak/callback")
        var redirectUri: String = "http://localhost:5173/auth/keycloak/callback",
    ) {
        fun isEnabled(): Boolean = clientId.isNotBlank() && issuerUri.isNotBlank()
    }

    class WebAuthn(
        @DefaultValue("") var rpId: String = "",
        @DefaultValue("porthole") var rpName: String = "porthole",
        @DefaultValue("http://localhost:5173") var origin: String = "http://localhost:5173",
    ) {
        fun isEnabled(): Boolean = rpId.isNotEmpty() && rpName.isNotBlank()
    }
}
