package team.dedica.porthole.adapter.out.messaging

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import team.dedica.porthole.domain.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class MapStateBroadcastDtoTest {

    private fun buildState(): MapState {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 3 })
        val state = MapState(map = map)
        state.collaborators.add(Collaborator(id = "u1", username = "alice"))
        state.landmarks["lm-1"] = Landmark(id = "lm-1", name = "Entrance")
        state.collaboratorMatrix.entries["lm-1"] = mutableMapOf(
            "u1" to CollaboratorMatrixEntry(MatrixLevel.HIGH)
        )
        return state
    }

    @Test
    fun `from produces a snapshot that is independent of the original state`() {
        val state = buildState()
        val dto = MapStateBroadcastDto.from(state)

        // Mutate originals after snapshot
        state.landmarks["lm-2"] = Landmark(id = "lm-2", name = "Exit")
        state.collaborators.add(Collaborator(id = "u2", username = "bob"))
        state.collaboratorMatrix.entries["lm-1"]!!["u1"] = CollaboratorMatrixEntry(MatrixLevel.LOW)
        state.collaboratorMatrix.entries["lm-2"] = mutableMapOf("u1" to CollaboratorMatrixEntry(MatrixLevel.MEDIUM))

        // DTO must still reflect the original snapshot (matrix is no longer part of the main DTO)
        assertEquals(1, dto.landmarks.size, "landmarks snapshot should not grow")
        assertEquals(1, dto.collaborators.size, "collaborators snapshot should not grow")
    }

    @Test
    fun `matrix snapshot via MapStateBroadcaster is independent of the original state`() {
        val state = buildState()
        // Capture a snapshot the same way MapStateBroadcaster.sendMatrix does
        val snapshot = CollaboratorMatrix(
            name = state.collaboratorMatrix.name,
            entries = state.collaboratorMatrix.entries.entries
                .associate { (k, v) -> k to v.toMap().toMutableMap() }.toMutableMap(),
        )

        // Mutate original after snapshot
        state.collaboratorMatrix.entries["lm-1"]!!["u1"] = CollaboratorMatrixEntry(MatrixLevel.LOW)
        state.collaboratorMatrix.entries["lm-2"] = mutableMapOf("u1" to CollaboratorMatrixEntry(MatrixLevel.MEDIUM))

        assertEquals(MatrixLevel.HIGH, snapshot.entries["lm-1"]!!["u1"]!!.level,
            "matrix snapshot should retain original value")
        assertNull(snapshot.entries["lm-2"], "new matrix rows must not appear in snapshot")
    }

    @Test
    fun `from does not throw ConcurrentModificationException when state is mutated concurrently`() {
        val state = buildState()
        // Pre-populate matrix with enough entries to make iteration non-trivial
        repeat(20) { i ->
            state.collaboratorMatrix.entries["lm-$i"] = mutableMapOf(
                "u1" to CollaboratorMatrixEntry(MatrixLevel.MEDIUM)
            )
        }

        val error = AtomicReference<Throwable?>()
        val latch = CountDownLatch(1)
        val executor = Executors.newSingleThreadExecutor()

        // Writer thread: continuously mutates the matrix while the main thread snapshots
        val writer = executor.submit {
            latch.await()
            repeat(1000) { i ->
                state.collaboratorMatrix.entries["lm-writer-$i"] =
                    ConcurrentHashMap<String, CollaboratorMatrixEntry>().also {
                        it["u1"] = CollaboratorMatrixEntry(MatrixLevel.LOW)
                    }
            }
        }

        latch.countDown()
        repeat(200) {
            try {
                MapStateBroadcastDto.from(state)
            } catch (t: Throwable) {
                error.set(t)
            }
        }

        writer.get(5, TimeUnit.SECONDS)
        executor.shutdown()

        assertNull(error.get()) { "Expected no exception during concurrent from(), got: ${error.get()}" }
    }
}



