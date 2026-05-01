package team.dedica.porthole.domain

import java.util.UUID

/**
 * Represents a collaborator working on a landscape map.
 *
 * @param id        unique collaborator ID (matches authentication user ID)
 * @param username  display name
 */
data class Collaborator(
    val id: UUID,
    val username: String,
    val avatarUrl: String? = null,
)
