package team.dedica.porthole.adapter.out.persistence

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonProperty
import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.databind.SerializationFeature
import com.fasterxml.jackson.databind.module.SimpleModule
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule
import com.fasterxml.jackson.module.kotlin.kotlinModule
import io.micronaut.context.annotation.Bean
import io.micronaut.context.annotation.Factory
import jakarta.inject.Named
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.HexTile
import team.dedica.porthole.domain.LandmarkType
import team.dedica.porthole.domain.Terrain

abstract class HexCoordinateMixin @JsonCreator constructor(
    @JsonProperty("q") q: Int,
    @JsonProperty("r") r: Int,
)

abstract class HexTileMixin @JsonCreator constructor(
    @JsonProperty("coordinate") coordinate: HexCoordinate,
    @JsonProperty("elevation") elevation: Int,
    @JsonProperty("terrain") terrain: Terrain,
)

@Factory
class JsonPersistenceConfig {

    @Named("persistenceObjectMapper")
    @Bean
    fun persistenceObjectMapper(): ObjectMapper {
        val hexKeyModule = SimpleModule().apply {
            addKeySerializer(HexCoordinate::class.java, HexCoordinateKeySerializer())
            addKeyDeserializer(HexCoordinate::class.java, HexCoordinateKeyDeserializer())
            // Fall back to KEEP for unknown/removed LandmarkType values in persisted JSON
            addDeserializer(LandmarkType::class.java, LandmarkTypeDeserializer())
        }

        return ObjectMapper()
            .registerModule(kotlinModule())
            .registerModule(JavaTimeModule())
            .registerModule(hexKeyModule)
            .addMixIn(HexCoordinate::class.java, HexCoordinateMixin::class.java)
            .addMixIn(HexTile::class.java, HexTileMixin::class.java)
            // Dates as ISO-8601 strings, not timestamps
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            // Enums as their name strings, not ordinal numbers
            .enable(SerializationFeature.WRITE_ENUMS_USING_TO_STRING)
            .enable(DeserializationFeature.READ_ENUMS_USING_TO_STRING)
            // Tolerate unknown fields (forward compatibility)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
    }
}

