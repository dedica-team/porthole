package team.dedica.porthole.adapter.out.persistence

import com.fasterxml.jackson.core.JsonGenerator
import com.fasterxml.jackson.databind.DeserializationContext
import com.fasterxml.jackson.databind.JsonSerializer
import com.fasterxml.jackson.databind.KeyDeserializer
import com.fasterxml.jackson.databind.SerializerProvider
import team.dedica.porthole.domain.HexCoordinate

/**
 * Serialises a [HexCoordinate] map key as the compact string "q:r".
 */
class HexCoordinateKeySerializer : JsonSerializer<HexCoordinate>() {
    override fun serialize(value: HexCoordinate, gen: JsonGenerator, serializers: SerializerProvider) {
        gen.writeFieldName("${value.q}:${value.r}")
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

