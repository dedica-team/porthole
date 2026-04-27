package team.dedica.porthole.adapter.`in`.web.security

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component

@Component
class AdminService(
    @param:Value("\${porthole.admin.user-ids:}") adminUserIdsRaw: String,
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

    fun isAdmin(userId: String): Boolean = adminIds.contains(userId)
}

