package team.dedica.porthole.adapter.out.persistence

import com.fasterxml.jackson.annotation.JsonCreator
import com.fasterxml.jackson.annotation.JsonProperty
import tools.jackson.databind.DeserializationFeature
import tools.jackson.databind.ObjectMapper
import tools.jackson.databind.cfg.EnumFeature
import tools.jackson.databind.json.JsonMapper
import tools.jackson.databind.module.SimpleModule
import tools.jackson.module.kotlin.kotlinModule
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

        return JsonMapper.builder()
            .addModule(kotlinModule())
            .addModule(hexKeyModule)
            .addMixIn(HexCoordinate::class.java, HexCoordinateMixin::class.java)
            .addMixIn(HexTile::class.java, HexTileMixin::class.java)
            .enable(EnumFeature.WRITE_ENUMS_USING_TO_STRING, EnumFeature.READ_ENUMS_USING_TO_STRING)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build()
    }
}
