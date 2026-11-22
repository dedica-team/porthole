package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.MediaType
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.Produces

@Controller
class OpenApiController {

    @Get("/api/openapi.yaml")
    @Produces("application/yaml", "text/yaml", MediaType.TEXT_PLAIN)
    fun getOpenApiYaml(): HttpResponse<String> {
        val resource = javaClass.classLoader.getResourceAsStream("openapi.yaml")
            ?: return HttpResponse.notFound()
        val content = resource.use { it.bufferedReader().readText() }
        return HttpResponse.ok(content)
            .contentType("application/yaml")
    }

    @Get("/openapi.yaml")
    @Produces("application/yaml", "text/yaml", MediaType.TEXT_PLAIN)
    fun getOpenApiYamlRoot(): HttpResponse<String> = getOpenApiYaml()
}
