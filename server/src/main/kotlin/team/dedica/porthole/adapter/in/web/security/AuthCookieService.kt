package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.http.HttpRequest
import io.micronaut.http.cookie.Cookie
import io.micronaut.http.cookie.SameSite
import jakarta.inject.Singleton
import team.dedica.porthole.config.PortholeAuthProperties
import java.time.Duration

@Singleton
class AuthCookieService(private val props: PortholeAuthProperties) {

    private val cookieName get() = props.cookie.cookieName
    private val cookiePath get() = props.cookie.cookiePath
    private val secureCookie get() = props.cookie.cookieSecure
    private val maxAge get() = props.cookie.maxAge
    private val sameSite: SameSite
        get() = runCatching {
            SameSite.valueOf(props.cookie.cookieSameSite.trim().replaceFirstChar { it.uppercase() })
        }.getOrDefault(SameSite.Lax)

    fun createAuthCookie(token: String): Cookie =
        Cookie.of(cookieName, token)
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite(sameSite)
            .path(cookiePath)
            .maxAge(maxAge)

    fun clearAuthCookie(): Cookie =
        Cookie.of(cookieName, "")
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite(sameSite)
            .path(cookiePath)
            .maxAge(Duration.ZERO)

    fun resolveCookieToken(request: HttpRequest<*>): String? =
        request.cookies.findCookie(cookieName)
            .map { it.value }
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .orElse(null)

    fun resolveToken(request: HttpRequest<*>): String? =
        request.headers.get(io.micronaut.http.HttpHeaders.AUTHORIZATION)
            ?.takeIf { it.startsWith("Bearer ", ignoreCase = true) }
            ?.substring("Bearer ".length)
            ?.trim()
            ?.takeIf { it.isNotEmpty() }
            ?: resolveCookieToken(request)
}
