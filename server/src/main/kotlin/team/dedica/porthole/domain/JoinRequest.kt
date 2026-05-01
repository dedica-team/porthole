package team.dedica.porthole.domain

import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.fasterxml.jackson.databind.ser.std.UUIDSerializer
import java.time.Instant
import java.util.UUID

data class JoinRequest(
    @param:JsonSerialize(using = UUIDSerializer::class)
    val id: UUID = UUID.randomUUID(),
    @param:JsonSerialize(using = UUIDSerializer::class)
    val userId: UUID,
    val username: String,
    val avatarUrl: String? = null,
    val requestedAt: Instant = Instant.now(),
)

