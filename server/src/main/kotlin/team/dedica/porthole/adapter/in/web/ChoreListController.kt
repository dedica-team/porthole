package team.dedica.porthole.adapter.`in`.web

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.application.session.chorelists.*
import java.util.UUID

@RestController
@RequestMapping("/api/maps/{id}/chore-lists")
class ChoreListController(
    private val listChoreListsUseCase: ListChoreListsUseCase,
    private val createChoreListUseCase: CreateChoreListUseCase,
    private val editChoreListUseCase: EditChoreListUseCase,
    private val removeChoreListUseCase: RemoveChoreListUseCase,
    private val toggleChoreListCompletedUseCase: ToggleChoreListCompletedUseCase,
    private val updateChoreEntryUseCase: UpdateChoreEntryUseCase,
) {

    @GetMapping
    fun listChoreLists(
        @PathVariable id: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(listChoreListsUseCase.execute(UUID.fromString(id), user.username))

    @PostMapping
    fun createChoreList(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateChoreListRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            createChoreListUseCase.execute(
                UUID.fromString(id),
                request.title,
                request.landmarkIds.map { UUID.fromString(it) },
                request.link,
                user.username
            )
        )

    @PatchMapping("/{listId}")
    fun editChoreList(
        @PathVariable id: String,
        @PathVariable listId: String,
        @Valid @RequestBody request: EditChoreListRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            editChoreListUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(listId),
                request.title,
                request.landmarkIds?.map { UUID.fromString(it) },
                request.link,
                request.clearLink,
                user.username
            )
        )

    @PatchMapping("/{listId}/complete")
    fun toggleComplete(
        @PathVariable id: String,
        @PathVariable listId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            toggleChoreListCompletedUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(listId),
                user.username
            )
        )

    @DeleteMapping("/{listId}")
    fun deleteChoreList(
        @PathVariable id: String,
        @PathVariable listId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Void> {
        removeChoreListUseCase.execute(UUID.fromString(id), UUID.fromString(listId), user.username)
        return ResponseEntity.noContent().build()
    }

    @PatchMapping("/{listId}/entries/{landmarkId}")
    fun updateChoreEntry(
        @PathVariable id: String,
        @PathVariable listId: String,
        @PathVariable landmarkId: String,
        @RequestBody request: UpdateChoreEntryRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            updateChoreEntryUseCase.execute(
                mapId = UUID.fromString(id),
                listId = UUID.fromString(listId),
                landmarkId = UUID.fromString(landmarkId),
                state = request.state,
                assigneeId = request.assigneeId,
                clearAssignee = request.clearAssignee,
                link = request.link,
                clearLink = request.clearLink,
                note = request.note,
                clearNote = request.clearNote,
                username = user.username,
            )
        )
}
