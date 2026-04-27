package team.dedica.porthole.adapter.`in`.web

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import team.dedica.porthole.adapter.`in`.web.dto.EditCollaboratorMatrixRequest
import team.dedica.porthole.adapter.`in`.web.dto.SetMatrixEntryRequest
import team.dedica.porthole.application.session.metrics.ClearMatrixEntryUseCase
import team.dedica.porthole.application.session.metrics.EditCollaboratorMatrixUseCase
import team.dedica.porthole.application.session.metrics.SetMatrixEntryUseCase
import team.dedica.porthole.domain.MatrixLevel

@RestController
@RequestMapping("/api/maps/{id}/collaborator-matrix")
class CollaboratorMatrixController(
    private val editCollaboratorMatrixUseCase: EditCollaboratorMatrixUseCase,
    private val setMatrixEntryUseCase: SetMatrixEntryUseCase,
    private val clearMatrixEntryUseCase: ClearMatrixEntryUseCase,
) {
    @PatchMapping
    fun editMatrix(
        @PathVariable id: String,
        @Valid @RequestBody request: EditCollaboratorMatrixRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> {
        val name = request.name?.trim()
        if (name.isNullOrBlank()) return ResponseEntity.badRequest().body("Matrix name must not be blank")
        return ResponseEntity.ok(editCollaboratorMatrixUseCase.execute(id, user.username, name))
    }

    @PutMapping("/landmarks/{landmarkId}/collaborators/{collaboratorId}")
    fun setEntry(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable collaboratorId: String,
        @RequestBody request: SetMatrixEntryRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> {
        val level = runCatching { MatrixLevel.valueOf(request.level.uppercase()) }
            .getOrElse { return ResponseEntity.badRequest().body("Unknown matrix level: ${request.level}") }
        return ResponseEntity.ok(setMatrixEntryUseCase.execute(id, user.username, landmarkId, collaboratorId, level))
    }

    @DeleteMapping("/landmarks/{landmarkId}/collaborators/{collaboratorId}")
    fun clearEntry(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable collaboratorId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<*> =
        ResponseEntity.ok(clearMatrixEntryUseCase.execute(id, user.username, landmarkId, collaboratorId))
}

