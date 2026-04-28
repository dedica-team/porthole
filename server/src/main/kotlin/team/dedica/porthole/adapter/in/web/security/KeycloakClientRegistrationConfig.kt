package team.dedica.porthole.adapter.`in`.web.security

import org.slf4j.LoggerFactory
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.oauth2.client.InMemoryOAuth2AuthorizedClientService
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientService
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.oauth2.client.registration.ClientRegistrations
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository
import org.springframework.security.oauth2.core.AuthorizationGrantType
import org.springframework.security.oauth2.core.ClientAuthenticationMethod
import team.dedica.porthole.config.PortholeAuthProperties

/**
 * Programmatically registers OAuth2 clients (GitHub, Keycloak) only when the respective
 * environment variables are non-blank.  This avoids Spring's auto-configuration validation
 * rejecting an empty client-id at startup, and keeps the repository consistent when only
 * a subset of providers is configured.
 *
 * Keycloak endpoint metadata (authorization URI, token URI, JWK set URI, etc.) is fetched
 * via OIDC Discovery ([ClientRegistrations.fromOidcIssuerLocation]) rather than being
 * hard-coded.  This ensures the registered endpoints are always correct regardless of
 * Keycloak version, realm path, or proxy configuration.
 */
@Configuration
class KeycloakClientRegistrationConfig(private val props: PortholeAuthProperties) {

    private val log = LoggerFactory.getLogger(KeycloakClientRegistrationConfig::class.java)

    val keycloakEnabled: Boolean get() = props.keycloak.isEnabled()
    val githubEnabled: Boolean get() = props.github.isEnabled()

    @Bean
    fun clientRegistrationRepository(): ClientRegistrationRepository {
        val registrations = buildList {
            if (githubEnabled) {
                add(
                    ClientRegistration.withRegistrationId("github")
                        .clientId(props.github.clientId)
                        .clientSecret(props.github.clientSecret.ifBlank { "" })
                        .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_BASIC)
                        .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                        .redirectUri("{baseUrl}/login/oauth2/code/github")
                        .scope("read:user", "user:email")
                        .authorizationUri("https://github.com/login/oauth/authorize")
                        .tokenUri("https://github.com/login/oauth/access_token")
                        .userInfoUri("https://api.github.com/user")
                        .userNameAttributeName("login")
                        .clientName("GitHub")
                        .build()
                )
            }
            if (keycloakEnabled) {
                add(buildKeycloakRegistration(props.keycloak))
            }
        }
        // InMemoryClientRegistrationRepository requires at least one entry.
        // Add a disabled placeholder when no provider is configured so the bean
        // can always be satisfied; the placeholder is never used for login.
        if (registrations.isEmpty()) {
            return ClientRegistrationRepository { _ -> null }
        }
        return InMemoryClientRegistrationRepository(registrations)
    }

    /**
     * Builds the Keycloak [ClientRegistration] by performing OIDC Discovery against
     * `{issuerUri}/.well-known/openid-configuration`.
     *
     * Discovery populates all endpoint URIs (authorization, token, userinfo, JWK set,
     * end-session) from the provider metadata, so the configuration stays correct even
     * when the Keycloak realm is behind a proxy or the Keycloak version changes URL
     * conventions.
     *
     * The client secret and authentication method are overlaid after discovery because
     * [ClientRegistrations.fromOidcIssuerLocation] returns a builder that uses
     * CLIENT_SECRET_BASIC by default; we override it to NONE for public (PKCE-only) clients.
     */
    private fun buildKeycloakRegistration(kc: PortholeAuthProperties.Keycloak): ClientRegistration {
        log.info("Fetching Keycloak OIDC discovery document from {}", kc.issuerUri)
        val discovered = runCatching {
            ClientRegistrations.fromOidcIssuerLocation(kc.issuerUri)
        }.getOrElse { ex ->
            throw IllegalStateException(
                "Failed to fetch Keycloak OIDC discovery document from '${kc.issuerUri}'. " +
                "Ensure PORTHOLE_KEYCLOAK_ISSUER_URI is correct and the Keycloak server is reachable at startup.",
                ex
            )
        }
        return discovered
            .registrationId("keycloak")
            .clientId(kc.clientId)
            .clientSecret(kc.clientSecret.ifBlank { "" })
            .clientAuthenticationMethod(
                if (kc.clientSecret.isBlank()) ClientAuthenticationMethod.NONE
                else ClientAuthenticationMethod.CLIENT_SECRET_BASIC
            )
            .scope("openid", "profile", "email")
            .redirectUri("{baseUrl}/login/oauth2/code/keycloak")
            .userNameAttributeName("preferred_username")
            .clientName("Keycloak")
            .build()
    }

    @Bean
    fun authorizedClientService(repo: ClientRegistrationRepository): OAuth2AuthorizedClientService =
        InMemoryOAuth2AuthorizedClientService(repo)
}

