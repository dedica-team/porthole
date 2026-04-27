package team.dedica.porthole.adapter.out.persistence

import com.fasterxml.jackson.core.JsonParser
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.deser.std.StdDeserializer
import org.slf4j.LoggerFactory
import team.dedica.porthole.domain.LandmarkType

/**
 * Deserialises a [LandmarkType] string value, falling back to [LandmarkType.KEEP]
 * for any unknown or removed type name (e.g. "WATERMILL", "DEPRECATED_WELL").
 */
class LandmarkTypeDeserializer : StdDeserializer<LandmarkType>(LandmarkType::class.java) {

    private val log = LoggerFactory.getLogger(javaClass)

    override fun deserialize(p: JsonParser, ctxt: DeserializationContext): LandmarkType {
        val raw = p.text?.trim() ?: return LandmarkType.KEEP
        return try {
            LandmarkType.valueOf(raw)
        } catch (_: IllegalArgumentException) {
            log.warn("Unknown LandmarkType '{}' in persisted data – falling back to KEEP", raw)
            LandmarkType.KEEP
        }
    }
}

