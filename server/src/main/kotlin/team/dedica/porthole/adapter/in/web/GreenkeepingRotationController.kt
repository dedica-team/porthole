package team.dedica.porthole.adapter.`in`.web

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import team.dedica.porthole.adapter.`in`.web.dto.CreateGreenkeepingRotationRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditGreenkeepingRotationRequest
import team.dedica.porthole.adapter.`in`.web.dto.GreenkeepingRotationCollaboratorRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.greenkeeping.*
import java.util.UUID

@RestController
@RequestMapping("/api/sessions/{id}/greenkeeping-rotations")
class GreenkeepingRotationController(
    private val listGreenkeepingRotationsUseCase: ListGreenkeepingRotationsUseCase,
    private val createGreenkeepingRotationUseCase: CreateGreenkeepingRotationUseCase,
    private val editGreenkeepingRotationUseCase: EditGreenkeepingRotationUseCase,
    private val removeGreenkeepingRotationUseCase: RemoveGreenkeepingRotationUseCase,
    private val advanceGreenkeepingRotationUseCase: AdvanceGreenkeepingRotationUseCase,
) {
    @GetMapping
    fun list(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(listGreenkeepingRotationsUseCase.execute(UUID.fromString(id), user.userId))

    @PostMapping
    fun create(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateGreenkeepingRotationRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
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

    @PatchMapping("/{rotationId}")
    fun edit(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @Valid @RequestBody request: EditGreenkeepingRotationRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
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

    @DeleteMapping("/{rotationId}")
    fun delete(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Void> {
        removeGreenkeepingRotationUseCase.execute(UUID.fromString(id), UUID.fromString(rotationId), user.userId)
        return ResponseEntity.noContent().build()
    }

    @PostMapping("/{rotationId}/advance")
    fun advance(
        @PathVariable id: String,
        @PathVariable rotationId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
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

