package team.dedica.porthole.adapter.out.persistence

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
import team.dedica.porthole.domain.LandmarkType

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
            // Dates as ISO-8601 strings, not timestamps
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            // Enums as their name strings, not ordinal numbers
            .enable(SerializationFeature.WRITE_ENUMS_USING_TO_STRING)
            .enable(DeserializationFeature.READ_ENUMS_USING_TO_STRING)
            // Tolerate unknown fields (forward compatibility)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
    }
}

