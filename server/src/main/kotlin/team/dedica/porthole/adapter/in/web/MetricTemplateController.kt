package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import team.dedica.porthole.application.port.GetMetricTemplatesPort

@Controller("/api/metric-templates")
class MetricTemplateController(
    private val getMetricTemplatesPort: GetMetricTemplatesPort,
) {
    @Get
    fun getTemplates(): HttpResponse<*> =
        HttpResponse.ok(getMetricTemplatesPort.getTemplates())
}
