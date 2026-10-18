package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.CreateConnectionRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditConnectionRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.landscaping.CreateConnectionUseCase
import team.dedica.porthole.application.session.landscaping.EditConnectionUseCase
import team.dedica.porthole.application.session.landscaping.RemoveConnectionUseCase
import team.dedica.porthole.domain.ConnectionType
import java.util.*

@Controller("/api/sessions/{id}/connections")
class ConnectionController(
    private val createConnectionUseCase: CreateConnectionUseCase,
    private val editConnectionUseCase: EditConnectionUseCase,
    private val removeConnectionUseCase: RemoveConnectionUseCase,
) {
    @Post
    fun createConnection(
        @PathVariable id: String,
        @Valid @Body request: CreateConnectionRequest,
         user: PortholePrincipal
    ): HttpResponse<*> {
        val type = runCatching { ConnectionType.valueOf(request.type.uppercase()) }.getOrElse {
            return HttpResponse.badRequest("Unknown connection type: ${request.type}")
        }
        return HttpResponse.ok(
            createConnectionUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(request.fromTowerId),
                UUID.fromString(request.toTowerId),
                type,
                request.name,
                request.description,
                user.userId
            )
        )
    }

    @Patch("/{connectionId}")
    fun editConnection(
        @PathVariable id: String,
        @PathVariable connectionId: String,
        @Valid @Body request: EditConnectionRequest,
         user: PortholePrincipal
    ): HttpResponse<*> {
        val type = request.type?.let {
            runCatching { ConnectionType.valueOf(it.uppercase()) }.getOrElse {
                return HttpResponse.badRequest("Unknown connection type: $it")
            }
        }
        return HttpResponse.ok(
            editConnectionUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(connectionId),
                type,
                request.name,
                request.description,
                request.clearName,
                request.clearDescription,
                user.userId
            )
        )
    }

    @Delete("/{connectionId}")
    fun removeConnection(
        @PathVariable id: String,
        @PathVariable connectionId: String,
         user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            removeConnectionUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(connectionId),
                user.userId
            )
        )
}
