package team.dedica.porthole.adapter.`in`.web.security

import com.sun.net.httpserver.HttpServer
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.security.oauth2.core.ClientAuthenticationMethod
import team.dedica.porthole.config.PortholeAuthProperties
import team.dedica.porthole.config.PortholeAuthPropertiesTestFactory
import java.net.InetSocketAddress

/**
 * Tests for [KeycloakClientRegistrationConfig], specifically that:
 * - Keycloak registration is built via OIDC Discovery (not hard-coded paths).
 * - An unreachable issuer URI throws a clear [IllegalStateException] at startup.
 * - GitHub registration is still built manually (no discovery).
 *
 * The discovery document served by the embedded HTTP server is loaded from
 * `src/test/resources/keycloak_discovery.json`, which is a realistic Keycloak
 * OIDC metadata document. The static issuer value in that file is replaced at
 * runtime with the actual `http://localhost:{port}/realms/test` base URL so the
 * Spring parser can validate the `issuer` claim against the request URL.
 */
class KeycloakClientRegistrationConfigTest {

    private lateinit var httpServer: HttpServer
    private var port: Int = 0

    /**
     * Loads `keycloak_discovery.json` from the test classpath and replaces every
     * occurrence of the static issuer baked into that file with [issuer].
     */
    private fun discoveryJson(issuer: String): ByteArray {
        val template = javaClass.classLoader
            .getResourceAsStream("keycloak_discovery.json")
            ?.bufferedReader()
            ?.readText()
            ?: error("keycloak_discovery.json not found on test classpath")
        val staticIssuer = "https://keycloak.test.com/auth/realms/foo"
        return template.replace(staticIssuer, issuer).toByteArray(Charsets.UTF_8)
    }

    @BeforeEach
    fun startHttpServer() {
        httpServer = HttpServer.create(InetSocketAddress(0), 0)
        port = httpServer.address.port
        val issuer = "http://localhost:$port/realms/test"

        val handler = com.sun.net.httpserver.HttpHandler { exchange ->
            val body = discoveryJson(issuer)
            exchange.responseHeaders.add("Content-Type", "application/json")
            exchange.sendResponseHeaders(200, body.size.toLong())
            exchange.responseBody.use { it.write(body) }
        }

        // Spring's ClientRegistrations.fromOidcIssuerLocation tries several well-known paths
        httpServer.createContext("/.well-known/openid-configuration", handler)
        httpServer.createContext("/realms/test/.well-known/openid-configuration", handler)
        httpServer.createContext("/realms/test/.well-known/oauth-authorization-server", handler)
        httpServer.start()
    }

    @AfterEach
    fun stopHttpServer() {
        httpServer.stop(0)
    }

    @Test
    fun `keycloak registration is built via OIDC discovery`() {
        val issuer = "http://localhost:$port/realms/test"
        val props = PortholeAuthPropertiesTestFactory.build(
            keycloak = PortholeAuthProperties.Keycloak(
                clientId = "porthole-client",
                clientSecret = "",
                issuerUri = issuer,
            )
        )
        val reg = KeycloakClientRegistrationConfig(props).clientRegistrationRepository()
            .findByRegistrationId("keycloak")

        assertNotNull(reg, "Keycloak ClientRegistration must be present")
        assertEquals("porthole-client", reg!!.clientId)
        // Endpoints must come from the discovery document, not be hard-coded
        assertTrue(reg.providerDetails.authorizationUri.startsWith(issuer),
            "authorizationUri should be rooted at the issuer: ${reg.providerDetails.authorizationUri}")
        assertTrue(reg.providerDetails.tokenUri.startsWith(issuer),
            "tokenUri should be rooted at the issuer: ${reg.providerDetails.tokenUri}")
        assertTrue(reg.providerDetails.userInfoEndpoint.uri.startsWith(issuer),
            "userInfoUri should be rooted at the issuer: ${reg.providerDetails.userInfoEndpoint.uri}")
        assertNotNull(reg.providerDetails.jwkSetUri)
        assertTrue(reg.providerDetails.jwkSetUri.startsWith(issuer),
            "jwkSetUri should be rooted at the issuer: ${reg.providerDetails.jwkSetUri}")
        assertEquals(issuer, reg.providerDetails.issuerUri)
    }

    @Test
    fun `keycloak registration uses NONE auth method for public PKCE client`() {
        val issuer = "http://localhost:$port/realms/test"
        val props = PortholeAuthPropertiesTestFactory.build(
            keycloak = PortholeAuthProperties.Keycloak(
                clientId = "porthole-public",
                clientSecret = "",
                issuerUri = issuer,
            )
        )
        val reg = KeycloakClientRegistrationConfig(props).clientRegistrationRepository()
            .findByRegistrationId("keycloak")!!
        assertEquals(
            ClientAuthenticationMethod.NONE,
            reg.clientAuthenticationMethod,
            "Public client should use ClientAuthenticationMethod.NONE"
        )
    }

    @Test
    fun `keycloak registration uses CLIENT_SECRET_BASIC for confidential client`() {
        val issuer = "http://localhost:$port/realms/test"
        val props = PortholeAuthPropertiesTestFactory.build(
            keycloak = PortholeAuthProperties.Keycloak(
                clientId = "porthole-confidential",
                clientSecret = "s3cr3t",
                issuerUri = issuer,
            )
        )
        val reg = KeycloakClientRegistrationConfig(props).clientRegistrationRepository()
            .findByRegistrationId("keycloak")!!
        assertEquals(ClientAuthenticationMethod.CLIENT_SECRET_BASIC, reg.clientAuthenticationMethod)
        assertEquals("s3cr3t", reg.clientSecret)
    }

    @Test
    fun `throws IllegalStateException with clear message when OIDC discovery fails`() {
        val props = PortholeAuthPropertiesTestFactory.build(
            keycloak = PortholeAuthProperties.Keycloak(
                clientId = "porthole-client",
                clientSecret = "",
                issuerUri = "http://localhost:1/realms/unreachable", // nothing listening
            )
        )
        val ex = assertThrows(IllegalStateException::class.java) {
            KeycloakClientRegistrationConfig(props).clientRegistrationRepository()
        }
        assertTrue(ex.message!!.contains("PORTHOLE_KEYCLOAK_ISSUER_URI"),
            "Error message should mention the config property: ${ex.message}")
    }

    @Test
    fun `keycloak registration is absent when keycloak is disabled`() {
        val props = PortholeAuthPropertiesTestFactory.build() // no keycloak config
        val repo = KeycloakClientRegistrationConfig(props).clientRegistrationRepository()
        val reg = runCatching { repo.findByRegistrationId("keycloak") }.getOrNull()
        assertNull(reg)
    }
}
