package team.dedica.porthole.adapter.`in`.web.security

import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.stereotype.Component
import org.springframework.web.filter.OncePerRequestFilter

/**
 * Stateless CSRF mitigation for cookie-authenticated APIs.
 *
 * Requires that any state-changing request (POST / PUT / PATCH / DELETE) to `/api/`
 * carries a custom header (`X-Requested-With`). Browsers will not attach custom
 * headers on simple cross-origin form submissions or navigations, so this blocks
 * classical CSRF attacks without needing a server-side token store.
 *
 * Paths outside `/api/` (static assets, SPA routes, OAuth callbacks handled by
 * Spring Security) and safe HTTP methods (GET, HEAD, OPTIONS) are exempt.
 */
@Component
class CsrfCustomHeaderFilter : OncePerRequestFilter() {

    private val safeMethods = setOf("GET", "HEAD", "OPTIONS")

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        val method = request.method.uppercase()
        val path = request.requestURI

        if (method in safeMethods || !path.startsWith("/api/")) {
            filterChain.doFilter(request, response)
            return
        }

        // Allow if the request has a Bearer token in the Authorization header
        // (non-browser clients that explicitly set Authorization don't need the extra header)
        val authHeader = request.getHeader("Authorization")
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response)
            return
        }

        // For cookie-authenticated requests, require the custom header
        val customHeader = request.getHeader(CUSTOM_HEADER_NAME)
        if (customHeader.isNullOrBlank()) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN, "Missing required header: $CUSTOM_HEADER_NAME")
            return
        }

        filterChain.doFilter(request, response)
    }

    companion object {
        const val CUSTOM_HEADER_NAME = "X-Requested-With"
    }
}

