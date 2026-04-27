package team.dedica.porthole.adapter.`in`.web.security

import jakarta.servlet.http.HttpServletRequest
import org.springframework.beans.factory.annotation.Value
import org.springframework.http.ResponseCookie
import org.springframework.stereotype.Component
import java.time.Duration

@Component
class AuthCookieService(
    @param:Value("\${porthole.auth.cookie-name:porthole_auth}") private val cookieName: String = "porthole_auth",
    @param:Value("\${porthole.auth.cookie-path:/}") private val cookiePath: String = "/",
    @param:Value("\${porthole.auth.cookie-same-site:Lax}") private val sameSite: String = "Lax",
    @param:Value("\${porthole.auth.cookie-secure:false}") private val secureCookie: Boolean = false,
    @param:Value("\${porthole.jwt.expiration-ms}") private val expirationMs: Long,
) {
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

