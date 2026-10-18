package team.dedica.porthole

import io.micronaut.runtime.Micronaut

/**
 * Micronaut application entry point.
 *
 * Scheduling and async execution are enabled by the Micronaut framework by default
 * (`micronaut-context`), so no annotation is required.
 */
class LandmarksApplication

fun main(args: Array<String>) {
    Micronaut.run(LandmarksApplication::class.java, *args)
}
