package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import team.dedica.porthole.application.port.GetMetricTemplatesUseCase
import team.dedica.porthole.domain.MetricTemplate

@RestController
@RequestMapping("/api/metric-templates")
class MetricTemplateController(
    private val getMetricTemplatesUseCase: GetMetricTemplatesUseCase,
) {
    @GetMapping
    fun getTemplates(): ResponseEntity<List<MetricTemplate>> =
        ResponseEntity.ok(getMetricTemplatesUseCase.getTemplates())
}
