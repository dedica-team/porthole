package team.dedica.porthole.adapter.`in`.web

import jakarta.validation.Valid
import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import team.dedica.porthole.adapter.`in`.web.security.AuthenticationPrincipal
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Delete
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.Patch
import io.micronaut.http.annotation.PathVariable
import io.micronaut.http.annotation.Post
import io.micronaut.http.annotation.Put
import io.micronaut.http.annotation.QueryValue
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.chorelists.*
import java.util.UUID

@Controller("/api/sessions/{id}/chore-lists")
class ChoreListController(
    private val listChoreListsUseCase: ListChoreListsUseCase,
    private val createChoreListUseCase: CreateChoreListUseCase,
    private val editChoreListUseCase: EditChoreListUseCase,
    private val removeChoreListUseCase: RemoveChoreListUseCase,
    private val toggleChoreListCompletedUseCase: ToggleChoreListCompletedUseCase,
    private val updateChoreEntryUseCase: UpdateChoreEntryUseCase,
) {
    @Get
    fun listChoreLists(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(listChoreListsUseCase.execute(UUID.fromString(id), user.userId))

    @Post
    fun createChoreList(
        @PathVariable id: String,
        @Valid @Body request: CreateChoreListRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            createChoreListUseCase.execute(
                UUID.fromString(id),
                request.title,
                request.landmarkIds.map { UUID.fromString(it) },
                request.link,
                request.description,
                user.userId
            )
        )

    @Patch("/{listId}")
    fun editChoreList(
        @PathVariable id: String,
        @PathVariable listId: String,
        @Valid @Body request: EditChoreListRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            editChoreListUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(listId),
                request.title,
                request.landmarkIds?.map { UUID.fromString(it) },
                request.link,
                request.clearLink,
                request.description,
                request.clearDescription,
                user.userId
            )
        )

    @Patch("/{listId}/complete")
    fun toggleComplete(
        @PathVariable id: String,
        @PathVariable listId: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            toggleChoreListCompletedUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(listId),
                user.userId
            )
        )

    @Delete("/{listId}")
    fun deleteChoreList(
        @PathVariable id: String,
        @PathVariable listId: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> {
        removeChoreListUseCase.execute(UUID.fromString(id), UUID.fromString(listId), user.userId)
        return HttpResponse.noContent<Any>()
    }

    @Patch("/{listId}/entries/{landmarkId}")
    fun updateChoreEntry(
        @PathVariable id: String,
        @PathVariable listId: String,
        @PathVariable landmarkId: String,
        @Body request: UpdateChoreEntryRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            updateChoreEntryUseCase.execute(
                sessionId = UUID.fromString(id),
                listId = UUID.fromString(listId),
                landmarkId = UUID.fromString(landmarkId),
                state = request.state,
                assigneeId = request.assigneeId,
                clearAssignee = request.clearAssignee,
                link = request.link,
                clearLink = request.clearLink,
                note = request.note,
                clearNote = request.clearNote,
                callerId = user.userId
            )
        )
}
