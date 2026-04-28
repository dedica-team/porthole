package team.dedica.porthole

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.scheduling.annotation.EnableAsync
import org.springframework.scheduling.annotation.EnableScheduling
import team.dedica.porthole.config.PortholeAuthProperties

@SpringBootApplication
@EnableAsync
@EnableScheduling
@EnableConfigurationProperties(PortholeAuthProperties::class)
class LandmarksApplication

fun main(args: Array<String>) {
    runApplication<LandmarksApplication>(*args)
}

