package team.dedica.porthole.domain

import com.fasterxml.jackson.databind.annotation.JsonSerialize
import com.fasterxml.jackson.databind.ser.std.UUIDSerializer
import java.util.UUID

data class ChoreEntry(
    @get:JsonSerialize(using = UUIDSerializer::class)
    val landmarkId: UUID,
    var state: ChoreEntryState = ChoreEntryState.NONE,
    var assigneeId: UUID? = null,
    var link: String? = null,
    var note: String? = null,
)
