package team.dedica.porthole.adapter.`in`.web.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.core.userdetails.User
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter
import team.dedica.porthole.application.port.UserPort

@Component
class JwtAuthenticationFilter(
    private val jwtTokenProvider: JwtTokenProvider,
    private val userRepository: UserPort,
    private val authCookieService: AuthCookieService,
) : OncePerRequestFilter() {

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain
    ) {
        val token = resolveToken(request)
        val claims = token?.let { runCatching { jwtTokenProvider.getTokenClaims(it) }.getOrNull() }
        if (claims != null) {
            val userRecord = userRepository.findById(claims.userId)
            val authorities = listOf(SimpleGrantedAuthority("ROLE_USER"))
            if (userRecord != null) {
                val principal = User(userRecord.username, "", authorities)
                val auth = UsernamePasswordAuthenticationToken(principal, null, authorities)
                SecurityContextHolder.getContext().authentication = auth
            } else {
                SecurityContextHolder.clearContext()
            }
        } else {
            SecurityContextHolder.clearContext()
        }
        filterChain.doFilter(request, response)
    }

    private fun resolveToken(request: HttpServletRequest): String? {
        val bearer = request.getHeader("Authorization")
            ?.takeIf { it.startsWith("Bearer ") }
            ?.substring(7)
            ?.trim()
            ?.takeIf { it.isNotBlank() }
        if (bearer != null) return bearer
        return authCookieService.resolveToken(request)
    }
}

