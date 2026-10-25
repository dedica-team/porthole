package team.dedica.porthole.domain

enum class SessionRole {
    VIEWER,           // no relationship to the map
    REQUEST_PENDING,  // has a pending join request
    COLLABORATOR,     // active participant on the map
    ADMIN;            // global admin (from configuration)

    /** Returns true if this role is at least as privileged as [required]. */
    fun mustHaveRole(required: SessionRole) {
        if (this.ordinal < required.ordinal) throw AccessDeniedException("User is not a $required in the session.")
    }
}

