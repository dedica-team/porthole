package team.dedica.porthole.domain

/**
 * Severity levels for quality metrics – ordered ascending by severity.
 * The [ordinal] is used for worst-of comparisons.
 */
enum class QualityLevel {
    NONE, OK, WARNING, ERROR;
}

