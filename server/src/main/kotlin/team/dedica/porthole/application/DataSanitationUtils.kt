package team.dedica.porthole.application

import java.net.URI

object DataSanitationUtils {

    val HEX_COLOR_REGEX = Regex("^#[0-9a-fA-F]{6}$")

    fun cleanLink(link: String): String? {
        val trimmed = link.trim()
        return if (trimmed.isBlank()) null
        else {
            val uri = runCatching { URI(trimmed) }.getOrNull()
            require(uri != null && uri.scheme in listOf("http", "https") && uri.host != null) {
                "Link must be a valid http/https URL"
            }
            trimmed
        }
    }

    fun cleanLinks(links: Map<String, String>): Map<String, String> {
        return links.entries.associate { (k, v) ->
            val trimmedKey = k.trim()
            require(trimmedKey.isNotBlank()) { "Link key must not be blank" }
            require(trimmedKey.length <= 200) { "Link key must not exceed 200 characters" }
            val cleanedUrl = cleanLink(v)
                ?: throw IllegalArgumentException("Link URL for '$trimmedKey' must be a valid http/https URL")
            trimmedKey to cleanedUrl
        }
    }

    /**
     * Normalizes a URL / git remote string to a canonical HTTPS format for deterministic matching.
     *
     * Rules:
     * - git@host:group/repo.git or ssh://git@host/group/repo.git -> https://host/group/repo
     * - http:// -> https://
     * - Lowercase host name
     * - Strip trailing '.git' from path
     * - Strip trailing slashes
     */
    fun normalizeCanonicalUrl(rawUrl: String): String {
        val trimmed = rawUrl.trim()
        if (trimmed.isBlank()) return ""

        // Handle SCP-style git URLs: git@github.com:org/repo.git
        val scpGitRegex = Regex("^[a-zA-Z0-9._-]+@([a-zA-Z0-9.-]+):(.+)$")
        val scpMatch = scpGitRegex.matchEntire(trimmed)
        val urlToParse = if (scpMatch != null) {
            val host = scpMatch.groupValues[1]
            val path = scpMatch.groupValues[2].trimStart('/')
            "https://$host/$path"
        } else if (trimmed.startsWith("ssh://", ignoreCase = true)) {
            val withoutScheme = trimmed.substring(6)
            val atIndex = withoutScheme.indexOf('@')
            val remainder = if (atIndex != -1) withoutScheme.substring(atIndex + 1) else withoutScheme
            "https://$remainder"
        } else if (!trimmed.contains("://")) {
            "https://$trimmed"
        } else {
            trimmed
        }

        val uri = runCatching { URI(urlToParse) }.getOrNull() ?: return trimmed.lowercase()

        val scheme = "https"
        val host = (uri.host ?: "").lowercase()
        var path = uri.path ?: ""

        // Strip trailing slashes
        while (path.endsWith("/") && path.length > 1) {
            path = path.substring(0, path.length - 1)
        }
        // Strip .git suffix
        if (path.endsWith(".git", ignoreCase = true)) {
            path = path.substring(0, path.length - 4)
        }
        // Strip trailing slash again if path was e.g. .git/
        while (path.endsWith("/") && path.length > 1) {
            path = path.substring(0, path.length - 1)
        }

        val portPart = if (uri.port != -1 && uri.port != 80 && uri.port != 443) ":${uri.port}" else ""
        val queryPart = if (uri.query != null) "?${uri.query}" else ""

        return if (host.isNotBlank()) {
            "$scheme://$host$portPart$path$queryPart"
        } else {
            trimmed.lowercase()
        }
    }
}