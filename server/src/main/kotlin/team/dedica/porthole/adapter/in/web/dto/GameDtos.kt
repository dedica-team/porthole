package team.dedica.porthole.adapter.`in`.web.dto

import io.micronaut.core.annotation.Introspected

@Introspected
data class ShootRequest(
    val originX: Double,
    val originY: Double,
    val originZ: Double,
    val dirX: Double,
    val dirY: Double,
    val dirZ: Double,
)
