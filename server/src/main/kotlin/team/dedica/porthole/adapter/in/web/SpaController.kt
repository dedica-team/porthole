package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.PathVariable
import io.micronaut.http.server.types.files.StreamedFile
import io.micronaut.web.router.resource.StaticResourceResolver
import java.net.URL

/**
 * SPA fallback, restoring the behaviour of the former Spring `SpaController`.
 *
 * The packaged client is served from `classpath:static` (see the Dockerfile). Micronaut's
 * static resource resolver only serves files that actually exist, so client-side routes
 * such as `/lobby` or `/session/{id}/map` would return 404 on refresh, on deep links and
 * after OAuth redirects. This controller serves the matching static file when one exists
 * and otherwise returns `index.html` so the React router can handle the route.
 *
 * Server-owned namespaces (`/api`, `/ws`, `/ws-native`, `/actuator`, `/health`, the OAuth
 * endpoints) and asset-looking paths (anything containing a dot) are never rewritten to
 * `index.html`.
 */
@Controller
class SpaController(
    private val staticResourceResolver: StaticResourceResolver,
) {
    @Get("/")
    fun root(): HttpResponse<*> = indexHtml()

    @Get("/{+path}")
    fun fallback(@PathVariable path: String): HttpResponse<*> {
        val requestPath = "/" + path.trimStart('/')
        staticResource(requestPath)?.let { return HttpResponse.ok<Any>(StreamedFile(it)) }

        if (isExcluded(requestPath)) {
            return HttpResponse.notFound<Any>()
        }
        return indexHtml()
    }

    private fun staticResource(path: String): URL? =
        staticResourceResolver.resolve(path).orElse(null)

    private fun indexHtml(): HttpResponse<*> =
        staticResourceResolver.resolve("/")
            .map<HttpResponse<*>> { HttpResponse.ok<Any>(StreamedFile(it)) }
            .orElseGet { HttpResponse.notFound<Any>() }

    private fun isExcluded(path: String): Boolean {
        val normalized = path.trimEnd('/').ifEmpty { "/" }
        if (EXCLUDED_PREFIXES.any { normalized == it || normalized.startsWith("$it/") }) {
            return true
        }
        return normalized.contains('.')
    }

    private companion object {
        val EXCLUDED_PREFIXES = listOf(
            "/api",
            "/ws",
            "/ws-native",
            "/actuator",
            "/health",
            "/oauth2",
            "/login",
            "/assets",
            "/fonts",
        )
    }
}
