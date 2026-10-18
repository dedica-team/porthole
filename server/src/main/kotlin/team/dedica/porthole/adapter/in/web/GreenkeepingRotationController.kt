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
import team.dedica.porthole.adapter.`in`.web.dto.CreateGreenkeepingRotationRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditGreenkeepingRotationRequest
import team.dedica.porthole.adapter.`in`.web.dto.GreenkeepingRotationCollaboratorRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.greenkeeping.*
import java.util.UUID

@Controller("/api/sessions/{id}/greenkeeping-rotations")
class GreenkeepingRotationController(
    private val listGreenkeepingRotationsUseCase: ListGreenkeepingRotationsUseCase,
    private val createGreenkeepingRotationUseCase: CreateGreenkeepingRotationUseCase,
    private val editGreenkeepingRotationUseCase: EditGreenkeepingRotationUseCase,
    private val removeGreenkeepingRotationUseCase: RemoveGreenkeepingRotationUseCase,
    private val advanceGreenkeepingRotationUseCase: AdvanceGreenkeepingRotationUseCase,
) {
    @Get
    fun list(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(listGreenkeepingRotationsUseCase.execute(UUID.fromString(id), user.userId))

    @Post
    fun create(
        @PathVariable id: String,
        @Valid @Body request: CreateGreenkeepingRotationRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            createGreenkeepingRotationUseCase.execute(
                sessionId = UUID.fromString(id),
                name = request.name,
                description = request.description,
                link = request.link,
                groupIds = request.groupIds.map(UUID::fromString),
                collaborators = request.collaborators.map { it.toPatch() },
                callerId = user.userId,
            )
        )

    @Patch("/{rotationId}")
    fun edit(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @Valid @Body request: EditGreenkeepingRotationRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
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
                callerId = user.userId,
            )
        )

    @Delete("/{rotationId}")
    fun delete(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> {
        removeGreenkeepingRotationUseCase.execute(UUID.fromString(id), UUID.fromString(rotationId), user.userId)
        return HttpResponse.noContent<Any>()
    }

    @Post("/{rotationId}/advance")
    fun advance(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            advanceGreenkeepingRotationUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(rotationId),
                user.userId,
            )
        )
}

private fun GreenkeepingRotationCollaboratorRequest.toPatch() = GreenkeepingRotationCollaboratorPatch(
    id = id,
    collaboratorId = collaboratorId,
)

