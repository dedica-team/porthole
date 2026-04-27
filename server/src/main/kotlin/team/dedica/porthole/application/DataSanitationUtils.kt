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
}