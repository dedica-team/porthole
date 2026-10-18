package team.dedica.porthole.adapter.`in`.web.security

import io.micronaut.context.annotation.Property
import jakarta.inject.Singleton
import org.slf4j.LoggerFactory
import java.util.*

@Singleton
class AdminService(
    @Property(name = "porthole.admin.user-ids", defaultValue = "") adminUserIdsRaw: String,
) {
    private val log = LoggerFactory.getLogger(AdminService::class.java)
    private val adminIds: Set<String> = adminUserIdsRaw
        .split(",")
        .map { it.trim() }
        .filter { it.isNotBlank() }
        .toSet()

    init {
        if (adminIds.isEmpty()) {
            log.warn("No admin user IDs configured (ADMIN_USER_IDS) — admin features disabled")
        } else {
            log.info("Admin role active for {} user(s)", adminIds.size)
        }
    }

    fun isAdmin(userId: UUID): Boolean = adminIds.contains(userId.toString())
}

