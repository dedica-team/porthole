package team.dedica.porthole.adapter.`in`.web

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.yaml.snakeyaml.Yaml

class OpenApiSpecificationTest {

    @Test
    fun `openapi spec file exists in resources and is valid OpenAPI 3 yaml`() {
        val resource = javaClass.classLoader.getResourceAsStream("openapi.yaml")
        assertNotNull(resource, "openapi.yaml should exist in classpath resources")

        val yaml = Yaml()
        val spec = resource!!.use { yaml.load<Map<String, Any>>(it) }
        assertNotNull(spec, "OpenAPI spec should parse successfully")

        assertEquals("3.0.3", spec["openapi"])

        @Suppress("UNCHECKED_CAST")
        val info = spec["info"] as Map<String, Any>
        assertEquals("Porthole Quality Metrics Push & Ingestion API", info["title"])
        assertNotNull(info["version"])

        @Suppress("UNCHECKED_CAST")
        val paths = spec["paths"] as Map<String, Any>
        assertTrue(paths.containsKey("/sessions/{id}/metrics/{metricId}/values"))
        assertTrue(paths.containsKey("/sessions/{id}/metrics/{metricId}/token"))
        assertTrue(paths.containsKey("/sessions/{id}/metrics/{metricId}/transformations"))
        assertTrue(paths.containsKey("/sessions/{id}/metrics/{metricId}/transformations/{transformationId}"))
        assertTrue(paths.containsKey("/sessions/{id}/elements/{elementId}/metrics/{metricId}"))

        @Suppress("UNCHECKED_CAST")
        val components = spec["components"] as Map<String, Any>
        @Suppress("UNCHECKED_CAST")
        val schemas = components["schemas"] as Map<String, Any>
        assertTrue(schemas.containsKey("PushMetricValuesRequest"))
        assertTrue(schemas.containsKey("MetricElementValueDto"))
        assertTrue(schemas.containsKey("PushMetricValuesResponse"))
        assertTrue(schemas.containsKey("PushTokenResponse"))
        assertTrue(schemas.containsKey("MetricTransformationDto"))
        assertTrue(schemas.containsKey("SetElementMetricRequest"))
        assertTrue(schemas.containsKey("MatchStrategy"))
        assertTrue(schemas.containsKey("QualityLevel"))
        assertTrue(schemas.containsKey("ErrorResponse"))

        @Suppress("UNCHECKED_CAST")
        val securitySchemes = components["securitySchemes"] as Map<String, Any>
        assertTrue(securitySchemes.containsKey("PushTokenAuth"))
        assertTrue(securitySchemes.containsKey("SessionCookieAuth"))
    }

    @Test
    fun `OpenApiController serves valid openapi spec`() {
        val controller = OpenApiController()
        val response = controller.getOpenApiYaml()
        assertEquals(200, response.status.code)
        val body = response.body()
        assertNotNull(body)
        assertTrue(body!!.contains("openapi: 3.0.3"))
        assertTrue(body.contains("Porthole Quality Metrics Push & Ingestion API"))

        val rootResponse = controller.getOpenApiYamlRoot()
        assertEquals(200, rootResponse.status.code)
        assertEquals(body, rootResponse.body())
    }
}
