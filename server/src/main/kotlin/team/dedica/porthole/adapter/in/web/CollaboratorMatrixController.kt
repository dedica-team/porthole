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
import team.dedica.porthole.application.session.metrics.*
import team.dedica.porthole.domain.MatrixLevel
import java.util.UUID

@Controller("/api/sessions/{id}/collaborator-matrix")
class CollaboratorMatrixController(
    private val getCollaboratorMatrixUseCase: GetCollaboratorMatrixUseCase,
    private val editCollaboratorMatrixUseCase: EditCollaboratorMatrixUseCase,
    private val setMatrixEntryUseCase: SetMatrixEntryUseCase,
    private val clearMatrixEntryUseCase: ClearMatrixEntryUseCase,
) {
    @Get
    fun getMatrix(@PathVariable id: String, @AuthenticationPrincipal user: PortholePrincipal): HttpResponse<*> =
        HttpResponse.ok(getCollaboratorMatrixUseCase.execute(UUID.fromString(id), user.userId))

    @Patch
    fun editMatrix(
        @PathVariable id: String,
        @Valid @Body request: EditCollaboratorMatrixRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> {
        val name = request.name?.trim()
        if (name.isNullOrBlank()) return HttpResponse.badRequest("Matrix name must not be blank")
        return HttpResponse.ok(editCollaboratorMatrixUseCase.execute(UUID.fromString(id), user.userId, name))
    }

    @Put("/landmarks/{landmarkId}/collaborators/{collaboratorId}")
    fun setEntry(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable collaboratorId: String,
        @Body request: SetMatrixEntryRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> {
        val level = runCatching { MatrixLevel.valueOf(request.level.uppercase()) }.getOrElse {
            return HttpResponse.badRequest("Unknown matrix level: ${request.level}")
        }
        return HttpResponse.ok(
            setMatrixEntryUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(landmarkId),
                UUID.fromString(collaboratorId),
                level
            )
        )
    }

    @Delete("/landmarks/{landmarkId}/collaborators/{collaboratorId}")
    fun clearEntry(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @PathVariable collaboratorId: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            clearMatrixEntryUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(landmarkId),
                UUID.fromString(collaboratorId)
            )
        )
}
