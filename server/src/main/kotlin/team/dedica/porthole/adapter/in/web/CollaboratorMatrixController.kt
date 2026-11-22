package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.EditCollaboratorMatrixRequest
import team.dedica.porthole.adapter.`in`.web.dto.SetMatrixEntryRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.metrics.ClearMatrixEntryUseCase
import team.dedica.porthole.application.session.metrics.EditCollaboratorMatrixUseCase
import team.dedica.porthole.application.session.metrics.GetCollaboratorMatrixUseCase
import team.dedica.porthole.application.session.metrics.SetMatrixEntryUseCase
import team.dedica.porthole.domain.MatrixLevel
import java.util.*

@Controller("/api/sessions/{id}/collaborator-matrix")
class CollaboratorMatrixController(
    private val getCollaboratorMatrixUseCase: GetCollaboratorMatrixUseCase,
    private val editCollaboratorMatrixUseCase: EditCollaboratorMatrixUseCase,
    private val setMatrixEntryUseCase: SetMatrixEntryUseCase,
    private val clearMatrixEntryUseCase: ClearMatrixEntryUseCase,
) {
    @Get
    fun getMatrix(@PathVariable id: String,  user: PortholePrincipal): HttpResponse<*> =
        HttpResponse.ok(getCollaboratorMatrixUseCase.execute(UUID.fromString(id), user.userId))

    @Patch
    fun editMatrix(
        @PathVariable id: String,
        @Valid @Body request: EditCollaboratorMatrixRequest,
         user: PortholePrincipal
    ): HttpResponse<*> {
        val name = request.name?.trim()
        if (request.name != null && name.isNullOrBlank()) return HttpResponse.badRequest("Matrix name must not be blank")
        return HttpResponse.ok(
            editCollaboratorMatrixUseCase.execute(
                UUID.fromString(id),
                user.userId,
                name,
                request.collaborators,
            )
        )
    }

    @Put("/elements/{elementId}/collaborators/{collaboratorId}")
    fun setEntry(
        @PathVariable id: String,
        @PathVariable elementId: String,
        @PathVariable collaboratorId: String,
        @Body request: SetMatrixEntryRequest,
         user: PortholePrincipal
    ): HttpResponse<*> {
        val level = runCatching { MatrixLevel.valueOf(request.level.uppercase()) }.getOrElse {
            return HttpResponse.badRequest("Unknown matrix level: ${request.level}")
        }
        return HttpResponse.ok(
            setMatrixEntryUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(elementId),
                UUID.fromString(collaboratorId),
                level
            )
        )
    }

    @Delete("/elements/{elementId}/collaborators/{collaboratorId}")
    fun clearEntry(
        @PathVariable id: String,
        @PathVariable elementId: String,
        @PathVariable collaboratorId: String,
         user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            clearMatrixEntryUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(elementId),
                UUID.fromString(collaboratorId)
            )
        )
}
