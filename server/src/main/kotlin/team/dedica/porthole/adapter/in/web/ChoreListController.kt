package team.dedica.porthole.adapter.`in`.web

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.application.session.chorelists.*

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
        ResponseEntity.ok(listChoreListsUseCase.execute(id, user.username))

    @PostMapping
    fun createChoreList(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateChoreListRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(createChoreListUseCase.execute(id, request.title, request.landmarkIds, request.link, user.username))

    @PatchMapping("/{listId}")
    fun editChoreList(
        @PathVariable id: String,
        @PathVariable listId: String,
        @Valid @RequestBody request: EditChoreListRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(editChoreListUseCase.execute(id, listId, request.title, request.landmarkIds, request.link, request.clearLink, user.username))

    @PatchMapping("/{listId}/complete")
    fun toggleComplete(
        @PathVariable id: String,
        @PathVariable listId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(toggleChoreListCompletedUseCase.execute(id, listId, user.username))

    @DeleteMapping("/{listId}")
    fun deleteChoreList(
        @PathVariable id: String,
        @PathVariable listId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Void> {
        removeChoreListUseCase.execute(id, listId, user.username)
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
                mapId = id,
                listId = listId,
                landmarkId = landmarkId,
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

