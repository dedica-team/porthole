package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.CreateChoreListRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditChoreListRequest
import team.dedica.porthole.adapter.`in`.web.dto.UpdateChoreEntryRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.chorelists.*
import java.util.*

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
         user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(listChoreListsUseCase.execute(UUID.fromString(id), user.userId))

    @Post
    fun createChoreList(
        @PathVariable id: String,
        @Valid @Body request: CreateChoreListRequest,
         user: PortholePrincipal
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
         user: PortholePrincipal
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
         user: PortholePrincipal
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
         user: PortholePrincipal
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
         user: PortholePrincipal
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
