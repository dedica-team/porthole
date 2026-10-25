package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.CreateGreenkeepingRotationRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditGreenkeepingRotationRequest
import team.dedica.porthole.adapter.`in`.web.dto.GreenkeepingChecklistItemRequest
import team.dedica.porthole.adapter.`in`.web.dto.GreenkeepingRotationCollaboratorRequest
import team.dedica.porthole.adapter.`in`.web.dto.GreenkeepingTaskTemplateItemRequest
import team.dedica.porthole.adapter.`in`.web.dto.StartGreenkeepingChecklistRequest
import team.dedica.porthole.adapter.`in`.web.dto.UpdateGreenkeepingChecklistRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.greenkeeping.*
import java.util.*

@Controller("/api/sessions/{id}/greenkeeping-rotations")
class GreenkeepingRotationController(
    private val listGreenkeepingRotationsUseCase: ListGreenkeepingRotationsUseCase,
    private val createGreenkeepingRotationUseCase: CreateGreenkeepingRotationUseCase,
    private val editGreenkeepingRotationUseCase: EditGreenkeepingRotationUseCase,
    private val removeGreenkeepingRotationUseCase: RemoveGreenkeepingRotationUseCase,
    private val advanceGreenkeepingRotationUseCase: AdvanceGreenkeepingRotationUseCase,
    private val startGreenkeepingChecklistUseCase: StartGreenkeepingChecklistUseCase,
    private val updateGreenkeepingChecklistUseCase: UpdateGreenkeepingChecklistUseCase,
    private val finishGreenkeepingChecklistUseCase: FinishGreenkeepingChecklistUseCase,
    private val discardGreenkeepingChecklistUseCase: DiscardGreenkeepingChecklistUseCase,
) {
    @Get
    fun list(
        @PathVariable id: String,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(listGreenkeepingRotationsUseCase.execute(UUID.fromString(id), user.userId))

    @Post
    fun create(
        @PathVariable id: String,
        @Valid @Body request: CreateGreenkeepingRotationRequest,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            createGreenkeepingRotationUseCase.execute(
                sessionId = UUID.fromString(id),
                name = request.name,
                description = request.description,
                link = request.link,
                groupIds = request.groupIds.map(UUID::fromString),
                collaborators = request.collaborators.map { it.toPatch() },
                taskTemplates = request.taskTemplates.map { it.toPatch() },
                callerId = user.userId,
            )
        )

    @Patch("/{rotationId}")
    fun edit(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @Valid @Body request: EditGreenkeepingRotationRequest,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            editGreenkeepingRotationUseCase.execute(
                sessionId = UUID.fromString(id),
                rotationId = UUID.fromString(rotationId),
                name = request.name,
                description = request.description,
                clearDescription = request.clearDescription,
                link = request.link,
                clearLink = request.clearLink,
                groupIds = request.groupIds?.map(UUID::fromString),
                collaborators = request.collaborators?.map { it.toPatch() },
                taskTemplates = request.taskTemplates?.map { it.toPatch() },
                callerId = user.userId,
            )
        )

    @Delete("/{rotationId}")
    fun delete(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        user: PortholePrincipal,
    ): HttpResponse<*> {
        removeGreenkeepingRotationUseCase.execute(UUID.fromString(id), UUID.fromString(rotationId), user.userId)
        return HttpResponse.noContent<Any>()
    }

    @Post("/{rotationId}/advance")
    fun advance(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            advanceGreenkeepingRotationUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(rotationId),
                user.userId,
            )
        )

    @Post("/{rotationId}/checklist")
    fun startChecklist(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @Valid @Body request: StartGreenkeepingChecklistRequest?,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            startGreenkeepingChecklistUseCase.execute(
                sessionId = UUID.fromString(id),
                rotationId = UUID.fromString(rotationId),
                title = request?.title,
                callerId = user.userId,
            )
        )

    @Put("/{rotationId}/checklist")
    fun updateChecklist(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @Valid @Body request: UpdateGreenkeepingChecklistRequest,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            updateGreenkeepingChecklistUseCase.execute(
                sessionId = UUID.fromString(id),
                rotationId = UUID.fromString(rotationId),
                title = request.title,
                items = request.items?.map { it.toPatch() },
                callerId = user.userId,
            )
        )

    @Post("/{rotationId}/checklist/finish")
    fun finishChecklist(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            finishGreenkeepingChecklistUseCase.execute(
                sessionId = UUID.fromString(id),
                rotationId = UUID.fromString(rotationId),
                callerId = user.userId,
            )
        )

    @Delete("/{rotationId}/checklist")
    fun discardChecklist(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            discardGreenkeepingChecklistUseCase.execute(
                sessionId = UUID.fromString(id),
                rotationId = UUID.fromString(rotationId),
                callerId = user.userId,
            )
        )
}

private fun GreenkeepingRotationCollaboratorRequest.toPatch() = GreenkeepingRotationCollaboratorPatch(
    id = id,
    collaboratorId = collaboratorId,
)

private fun GreenkeepingTaskTemplateItemRequest.toPatch() = GreenkeepingTaskTemplateItemPatch(
    id = id,
    title = title,
)

private fun GreenkeepingChecklistItemRequest.toPatch() = GreenkeepingChecklistItemPatch(
    id = id,
    title = title,
    done = done,
    note = note,
)

