package team.dedica.porthole.adapter.`in`.web

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.metrics.*
import team.dedica.porthole.domain.MatrixLevel
import java.util.UUID

@RestController
@RequestMapping("/api/maps/{id}/collaborator-matrix")
class CollaboratorMatrixController(
    private val getCollaboratorMatrixUseCase: GetCollaboratorMatrixUseCase,
    private val editCollaboratorMatrixUseCase: EditCollaboratorMatrixUseCase,
    private val setMatrixEntryUseCase: SetMatrixEntryUseCase,
    private val clearMatrixEntryUseCase: ClearMatrixEntryUseCase,
) {
    @GetMapping
    fun getMatrix(@PathVariable id: String, @AuthenticationPrincipal user: PortholePrincipal): ResponseEntity<Any> =
        ResponseEntity.ok(getCollaboratorMatrixUseCase.execute(UUID.fromString(id), user.userId))

    @PatchMapping
    fun editMatrix(
        @PathVariable id: String,
        @Valid @RequestBody request: EditCollaboratorMatrixRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<Any> {
        val name = request.name?.trim()
        if (name.isNullOrBlank()) return ResponseEntity.badRequest().body("Matrix name must not be blank")
        return ResponseEntity.ok(editCollaboratorMatrixUseCase.execute(UUID.fromString(id), user.userId, name))
    }

    @PutMapping("/landmarks/{landmarkId}/collaborators/{collaboratorId}")
    fun setEntry(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable collaboratorId: String,
        @RequestBody request: SetMatrixEntryRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<Any> {
        val level = runCatching { MatrixLevel.valueOf(request.level.uppercase()) }.getOrElse {
            return ResponseEntity.badRequest().body("Unknown matrix level: ${request.level}")
        }
        return ResponseEntity.ok(
            setMatrixEntryUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(landmarkId),
                UUID.fromString(collaboratorId),
                level
            )
        )
    }

    @DeleteMapping("/landmarks/{landmarkId}/collaborators/{collaboratorId}")
    fun clearEntry(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable collaboratorId: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<*> =
        ResponseEntity.ok(
            clearMatrixEntryUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(landmarkId),
                UUID.fromString(collaboratorId)
            )
        )
}
