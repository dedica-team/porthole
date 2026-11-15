package team.dedica.porthole.config

import io.micronaut.context.annotation.ConfigurationProperties
import io.micronaut.core.annotation.Introspected
import java.time.Duration

@ConfigurationProperties("porthole.auth")
@Introspected
class PortholeAuthProperties {
    var cookie: Cookie = Cookie()
    var allowedOrigins: String = "http://localhost:5173,http://localhost:8080"
    var github: GitHub = GitHub()
    var keycloak: Keycloak = Keycloak()
    var webauthn: WebAuthn = WebAuthn()
    var tagline: String = "for teams"

    @Introspected
    @ConfigurationProperties("cookie")
    class Cookie {
        var cookieName: String = "porthole_auth"
        var cookiePath: String = "/"
        var cookieSameSite: String = "Lax"
        var cookieSecure: Boolean = false
        var maxAge: Duration = Duration.ofDays(1)
    }

    @Introspected
    @ConfigurationProperties("github")
    class GitHub {
        var clientId: String = ""
        var clientSecret: String = ""
        var redirectUri: String = "http://localhost:5173/auth/github/callback"

        fun isEnabled(): Boolean = clientId.isNotBlank() && clientSecret.isNotBlank()
    }

    @Introspected
    @ConfigurationProperties("keycloak")
    class Keycloak {
        var clientId: String = ""
        var clientSecret: String = ""
        var issuerUri: String = ""
        var redirectUri: String = "http://localhost:5173/auth/keycloak/callback"

        fun isEnabled(): Boolean = clientId.isNotBlank() && issuerUri.isNotBlank()
    }

    @Introspected
    @ConfigurationProperties("webauthn")
    class WebAuthn {
        var rpId: String = ""
        var rpName: String = "porthole"
        var origin: String = "http://localhost:5173"

        fun isEnabled(): Boolean = rpId.isNotEmpty() && rpName.isNotBlank()
    }
}
