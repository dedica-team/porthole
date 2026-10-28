package team.dedica.porthole.adapter.out.persistence

import tools.jackson.core.JsonGenerator
import tools.jackson.databind.DeserializationContext
import tools.jackson.databind.KeyDeserializer
import tools.jackson.databind.SerializationContext
import tools.jackson.databind.ValueSerializer
import team.dedica.porthole.domain.HexCoordinate

/**
 * Serialises a [HexCoordinate] map key as the compact string "q:r".
 */
class HexCoordinateKeySerializer : ValueSerializer<HexCoordinate>() {
    override fun serialize(value: HexCoordinate, gen: JsonGenerator, ctxt: SerializationContext) {
        gen.writeName("${value.q}:${value.r}")
    }
}

/**
 * Deserialises a "q:r" map-key string back into a [HexCoordinate].
 */
class HexCoordinateKeyDeserializer : KeyDeserializer() {
    override fun deserializeKey(key: String, ctxt: DeserializationContext): HexCoordinate {
        val parts = key.split(":")
        require(parts.size == 2) { "Invalid HexCoordinate key: '$key'" }
        val q = parts[0].toIntOrNull()
            ?: throw IllegalArgumentException("Invalid HexCoordinate key (q is not an integer): '$key'")
        val r = parts[1].toIntOrNull()
            ?: throw IllegalArgumentException("Invalid HexCoordinate key (r is not an integer): '$key'")
        return HexCoordinate(q, r)
    }
}
