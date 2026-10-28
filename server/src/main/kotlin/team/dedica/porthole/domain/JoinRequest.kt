package team.dedica.porthole.domain

import java.time.Instant
import java.util.UUID

data class JoinRequest(
    val id: UUID = UUID.randomUUID(),
    val userId: UUID,
    val username: String,
    val avatarUrl: String? = null,
    val requestedAt: Instant = Instant.now(),
)
