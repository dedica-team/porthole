package team.dedica.porthole

import io.micronaut.runtime.Micronaut

class PortholeApplication

fun main(args: Array<String>) {
    Micronaut.run(PortholeApplication::class.java, *args)
}
