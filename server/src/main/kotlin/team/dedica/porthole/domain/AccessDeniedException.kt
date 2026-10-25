package team.dedica.porthole.domain

/**
 * Thrown when an authenticated caller lacks the role required for an operation.
 * Lives in the domain layer because authorization rules (e.g. [SessionRole.mustHaveRole])
 * are domain concepts; the web layer maps it to HTTP 403.
 */
class AccessDeniedException(reason: String) : RuntimeException(reason)
