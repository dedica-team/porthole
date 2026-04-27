package team.dedica.porthole.domain

import kotlin.math.floor

/**
 * Simple 2D Perlin noise implementation used for procedural map generation.
 *
 * @param seed random seed controlling the permutation table
 */
internal class PerlinNoise(seed: Long) {
    private val perm = IntArray(512)

    init {
        val rng = java.util.Random(seed)
        val base = IntArray(256) { it }.also { arr ->
            for (i in 255 downTo 1) {
                val j = rng.nextInt(i + 1)
                val tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp
            }
        }
        repeat(256) { i -> perm[i] = base[i]; perm[i + 256] = base[i] }
    }

    fun noise(x: Double, y: Double): Double {
        val xi = floor(x).toInt() and 255
        val yi = floor(y).toInt() and 255
        val xf = x - floor(x)
        val yf = y - floor(y)
        val u = fade(xf)
        val v = fade(yf)
        val aa = perm[perm[xi    ] + yi    ]
        val ab = perm[perm[xi    ] + yi + 1]
        val ba = perm[perm[xi + 1] + yi    ]
        val bb = perm[perm[xi + 1] + yi + 1]
        return lerp(v,
            lerp(u, grad(aa, xf,     yf    ), grad(ba, xf - 1, yf    )),
            lerp(u, grad(ab, xf,     yf - 1), grad(bb, xf - 1, yf - 1)))
    }

    fun octave(x: Double, y: Double, octaves: Int, persistence: Double, lacunarity: Double): Double {
        var value = 0.0; var amplitude = 1.0; var frequency = 1.0; var maxValue = 0.0
        repeat(octaves) {
            value += noise(x * frequency, y * frequency) * amplitude
            maxValue += amplitude; amplitude *= persistence; frequency *= lacunarity
        }
        return value / maxValue
    }

    private fun fade(t: Double) = t * t * t * (t * (t * 6 - 15) + 10)
    private fun lerp(t: Double, a: Double, b: Double) = a + t * (b - a)
    private fun grad(hash: Int, x: Double, y: Double) = when (hash and 3) {
        0 -> x + y; 1 -> -x + y; 2 -> x - y; else -> -x - y
    }
}

