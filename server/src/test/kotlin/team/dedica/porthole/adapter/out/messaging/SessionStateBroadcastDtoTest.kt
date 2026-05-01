package team.dedica.porthole.adapter.out.messaging

import java.util.UUID

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import team.dedica.porthole.domain.*
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class SessionStateBroadcastDtoTest {

    private val lmId = UUID.nameUUIDFromBytes("lm-1".toByteArray())

    private fun buildState(): SessionState {
        val map = HexMap.createHexagonal(radius = 2, elevationFn = { 3 })
        val state = SessionState(map = map)
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u1".toByteArray()), username = "alice"))
        state.landmarks[lmId] = Landmark(id = lmId, name = "Entrance")
        state.collaboratorMatrix.entries[lmId] = mutableMapOf(
            UUID.nameUUIDFromBytes("u1".toByteArray()) to CollaboratorMatrixEntry(MatrixLevel.HIGH)
        )
        return state
    }

    @Test
    fun `from produces a snapshot that is independent of the original state`() {
        val state = buildState()
        val dto = MapStateBroadcastDto.from(state)

        state.landmarks[UUID.randomUUID()] = Landmark(id = UUID.randomUUID(), name = "Exit")
        state.collaborators.add(Collaborator(id = UUID.nameUUIDFromBytes("u2".toByteArray()), username = "bob"))
        state.collaboratorMatrix.entries[lmId]!![UUID.nameUUIDFromBytes("u1".toByteArray())] = CollaboratorMatrixEntry(MatrixLevel.LOW)
        state.collaboratorMatrix.entries[UUID.randomUUID()] = mutableMapOf(UUID.nameUUIDFromBytes("u1".toByteArray()) to CollaboratorMatrixEntry(MatrixLevel.MEDIUM))

        assertEquals(1, dto.landmarks.size, "landmarks snapshot should not grow")
        assertEquals(1, dto.collaborators.size, "collaborators snapshot should not grow")
    }

    @Test
    fun `matrix snapshot via MapStateBroadcaster is independent of the original state`() {
        val state = buildState()
        val u1 = UUID.nameUUIDFromBytes("u1".toByteArray())
        val snapshot = CollaboratorMatrix(
            name = state.collaboratorMatrix.name,
            entries = state.collaboratorMatrix.entries.entries
                .associate { (k, v) -> k to v.toMap().toMutableMap() }.toMutableMap(),
        )

        state.collaboratorMatrix.entries[lmId]!![u1] = CollaboratorMatrixEntry(MatrixLevel.LOW)
        state.collaboratorMatrix.entries[UUID.randomUUID()] = mutableMapOf(u1 to CollaboratorMatrixEntry(MatrixLevel.MEDIUM))

        assertEquals(MatrixLevel.HIGH, snapshot.entries[lmId]!![u1]!!.level,
            "matrix snapshot should retain original value")
        assertEquals(1, snapshot.entries.size, "new matrix rows must not appear in snapshot")
    }

    @Test
    fun `from does not throw ConcurrentModificationException when state is mutated concurrently`() {
        val state = buildState()
        val u1 = UUID.nameUUIDFromBytes("u1".toByteArray())
        repeat(20) { i ->
            state.collaboratorMatrix.entries[UUID.nameUUIDFromBytes("lm-$i".toByteArray())] = mutableMapOf(
                u1 to CollaboratorMatrixEntry(MatrixLevel.MEDIUM)
            )
        }

        val error = AtomicReference<Throwable?>()
        val latch = CountDownLatch(1)
        val executor = Executors.newSingleThreadExecutor()

        val writer = executor.submit {
            latch.await()
            repeat(1000) { i ->
                state.collaboratorMatrix.entries[UUID.nameUUIDFromBytes("lm-writer-$i".toByteArray())] =
                    ConcurrentHashMap<UUID, CollaboratorMatrixEntry>().also {
                        it[u1] = CollaboratorMatrixEntry(MatrixLevel.LOW)
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
