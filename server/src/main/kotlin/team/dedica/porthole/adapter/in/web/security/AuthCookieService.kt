package team.dedica.porthole.adapter.`in`.web.security

import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import team.dedica.porthole.config.PortholeAuthProperties
import java.time.Duration

@Component
class AuthCookieService(private val props: PortholeAuthProperties) {

    private val cookieName get() = props.cookie.cookieName
    private val cookiePath get() = props.cookie.cookiePath
    private val sameSite get() = props.cookie.cookieSameSite
    private val secureCookie get() = props.cookie.cookieSecure
    private val expirationMs get() = props.jwt.expirationMs

    fun createAuthCookie(token: String): ResponseCookie =
        ResponseCookie.from(cookieName, token)
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite(sameSite)
            .path(cookiePath)
            .maxAge(Duration.ofMillis(expirationMs))
            .build()

    fun clearAuthCookie(): ResponseCookie =
        ResponseCookie.from(cookieName, "")
            .httpOnly(true)
            .secure(secureCookie)
            .sameSite(sameSite)
            .path(cookiePath)
            .maxAge(Duration.ZERO)
            .build()

    fun resolveToken(request: HttpServletRequest): String? =
        request.cookies
            ?.firstOrNull { it.name == cookieName }
            ?.value
            ?.trim()
            ?.takeIf { it.isNotBlank() }
}

