package team.dedica.porthole.adapter.`in`.web.security

import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import team.dedica.porthole.config.PortholeAuthProperties

@Configuration
@EnableWebSecurity
class SecurityConfig(
    private val jwtAuthenticationFilter: JwtAuthenticationFilter,
    private val csrfCustomHeaderFilter: CsrfCustomHeaderFilter,
    private val keycloakClientRegistrationConfig: KeycloakClientRegistrationConfig,
    private val clientRegistrationRepository: ClientRegistrationRepository,
    private val props: PortholeAuthProperties,
) {
    @Autowired(required = false)
    private var keycloakLoginSuccessHandler: KeycloakLoginSuccessHandler? = null
    @Bean
    fun filterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            .csrf { it.disable() }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                it.requestMatchers("/actuator/**").permitAll()
                it.requestMatchers("/api/auth/**").permitAll()
                it.requestMatchers("/ws/**").permitAll()
                it.requestMatchers("/ws-native/**").permitAll()
                it.requestMatchers(
                    "/", "/index.html",
                    "/assets/**",
                    "/fonts/**",
                    "/*.js", "/*.css", "/*.svg", "/*.ico", "/*.png", "/*.webmanifest",
                    "/auth/**", "/lobby", "/lobby/**", "/map/**",
                ).permitAll()
                if (keycloakClientRegistrationConfig.keycloakEnabled) {
                    it.requestMatchers("/oauth2/**", "/login/oauth2/**").permitAll()
                }
                it.anyRequest().authenticated()
            }
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
            .addFilterAfter(csrfCustomHeaderFilter, JwtAuthenticationFilter::class.java)

        if (keycloakClientRegistrationConfig.keycloakEnabled) {
            http.oauth2Login { oauth2 ->
                oauth2
                    .clientRegistrationRepository(clientRegistrationRepository)
                    .also { cfg ->
                        keycloakLoginSuccessHandler?.let { cfg.successHandler(it) }
                    }
                    .failureHandler { _, response, ex ->
                        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, ex.message)
                    }
            }
        }

        return http.build()
    }

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val origins = props.allowedOrigins.split(",").map { it.trim() }
        val config = CorsConfiguration()
        config.allowedOrigins = origins
        config.allowedMethods = listOf("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
        config.allowedHeaders = listOf("*")
        config.allowCredentials = true
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", config)
        return source
    }
}
