package team.dedica.porthole.application.port

import team.dedica.porthole.domain.MetricTemplate

/**
 * Input port for retrieving the list of pre-defined metric templates.
 */
interface GetMetricTemplatesUseCase {
    fun getTemplates(): List<MetricTemplate>
}

