package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.landscaping.*
import team.dedica.porthole.domain.ConnectionType
import java.util.UUID

@RestController
@RequestMapping("/api/maps/{id}/connections")
class ConnectionController(
    private val createConnectionUseCase: CreateConnectionUseCase,
    private val editConnectionUseCase: EditConnectionUseCase,
    private val removeConnectionUseCase: RemoveConnectionUseCase,
) {
    @PostMapping
    fun createConnection(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateConnectionRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<Any> {
        val type = runCatching { ConnectionType.valueOf(request.type.uppercase()) }.getOrElse {
            return ResponseEntity.badRequest().body("Unknown connection type: ${request.type}")
        }
        return ResponseEntity.ok(
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

    @PatchMapping("/{connectionId}")
    fun editConnection(
        @PathVariable id: String,
        @PathVariable connectionId: String,
        @Valid @RequestBody request: EditConnectionRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<Any> {
        val type = request.type?.let {
            runCatching { ConnectionType.valueOf(it.uppercase()) }.getOrElse {
                return ResponseEntity.badRequest().body("Unknown connection type: $it")
            }
        }
        return ResponseEntity.ok(
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

    @DeleteMapping("/{connectionId}")
    fun removeConnection(
        @PathVariable id: String,
        @PathVariable connectionId: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            removeConnectionUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(connectionId),
                user.userId
            )
        )
}
