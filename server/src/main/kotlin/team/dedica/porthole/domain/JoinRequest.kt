package team.dedica.porthole.domain

import java.time.Instant
import java.util.UUID

data class JoinRequest(
    val id: String = UUID.randomUUID().toString(),
    val userId: String,
    val username: String,
    val avatarUrl: String? = null,
    val requestedAt: Instant = Instant.now(),
)

