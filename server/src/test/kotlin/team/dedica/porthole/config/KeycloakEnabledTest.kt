package team.dedica.porthole.config

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

class KeycloakEnabledTest {

    @Test
    fun `keycloak is enabled with clientId and issuerUri`() {
        val kc = PortholeAuthProperties.Keycloak(
            clientId = "my-client",
            clientSecret = "",
            issuerUri = "https://keycloak.example.com/realms/test",
        )
        assertTrue(kc.isEnabled(), "Keycloak should be enabled for public PKCE clients (no secret)")
    }

    @Test
    fun `keycloak is enabled with clientId, secret, and issuerUri`() {
        val kc = PortholeAuthProperties.Keycloak(
            clientId = "my-client",
            clientSecret = "my-secret",
            issuerUri = "https://keycloak.example.com/realms/test",
        )
        assertTrue(kc.isEnabled(), "Keycloak should be enabled for confidential clients")
    }

    @Test
    fun `keycloak is disabled when clientId is blank`() {
        val kc = PortholeAuthProperties.Keycloak(
            clientId = "",
            clientSecret = "my-secret",
            issuerUri = "https://keycloak.example.com/realms/test",
        )
        assertFalse(kc.isEnabled())
    }

    @Test
    fun `keycloak is disabled when issuerUri is blank`() {
        val kc = PortholeAuthProperties.Keycloak(
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

    @Test
    fun `jwt isUsingDefaultSecret returns true for default secret`() {
        val jwt = PortholeAuthProperties.Jwt(
            secret = PortholeAuthProperties.Jwt.INSECURE_DEFAULT,
        )
        assertTrue(jwt.isUsingDefaultSecret())
    }

    @Test
    fun `jwt isUsingDefaultSecret returns false for custom secret`() {
        val jwt = PortholeAuthProperties.Jwt(
            secret = "my-very-secure-custom-secret-for-production-use!!",
        )
        assertFalse(jwt.isUsingDefaultSecret())
    }
}

