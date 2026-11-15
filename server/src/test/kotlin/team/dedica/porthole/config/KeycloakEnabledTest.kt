package team.dedica.porthole.config

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class KeycloakEnabledTest {

    private fun keycloak(clientId: String, clientSecret: String, issuerUri: String) =
        PortholeAuthProperties.Keycloak().apply {
            this.clientId = clientId
            this.clientSecret = clientSecret
            this.issuerUri = issuerUri
        }

    @Test
    fun `keycloak is enabled with clientId and issuerUri`() {
        val kc = keycloak(
            clientId = "my-client",
            clientSecret = "",
            issuerUri = "https://keycloak.example.com/realms/test",
        )
        assertTrue(kc.isEnabled(), "Keycloak should be enabled for public PKCE clients (no secret)")
    }

    @Test
    fun `keycloak is enabled with clientId, secret, and issuerUri`() {
        val kc = keycloak(
            clientId = "my-client",
            clientSecret = "my-secret",
            issuerUri = "https://keycloak.example.com/realms/test",
        )
        assertTrue(kc.isEnabled(), "Keycloak should be enabled for confidential clients")
    }

    @Test
    fun `keycloak is disabled when clientId is blank`() {
        val kc = keycloak(
            clientId = "",
            clientSecret = "my-secret",
            issuerUri = "https://keycloak.example.com/realms/test",
        )
        assertFalse(kc.isEnabled())
    }

    @Test
    fun `keycloak is disabled when issuerUri is blank`() {
        val kc = keycloak(
            clientId = "my-client",
            clientSecret = "",
            issuerUri = "",
        )
        assertFalse(kc.isEnabled())
    }

    @Test
    fun `keycloak is disabled with all defaults`() {
        val kc = PortholeAuthProperties.Keycloak()
        assertFalse(kc.isEnabled())
    }
}
