package team.dedica.porthole

import io.micronaut.runtime.Micronaut

class PortholeApplication

fun main(args: Array<String>) {
    Micronaut.build(*args)
        .packages("team.dedica.porthole")
        .mainClass(PortholeApplication::class.java)
        .start()
}

