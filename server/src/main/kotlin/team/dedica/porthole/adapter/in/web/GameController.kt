package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.Body
import io.micronaut.http.annotation.Controller
import io.micronaut.http.annotation.Get
import io.micronaut.http.annotation.PathVariable
import io.micronaut.http.annotation.Post
import team.dedica.porthole.adapter.`in`.web.dto.ShootRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.game.EnterWatchtowerUseCase
import team.dedica.porthole.application.session.game.LeaveWatchtowerUseCase
import team.dedica.porthole.application.session.game.ShootUseCase
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.domain.GameState
import team.dedica.porthole.domain.SessionRole
import team.dedica.porthole.domain.Vec3
import java.util.UUID

@Controller("/api/sessions/{id}/game")
class GameController(
    private val enterWatchtowerUseCase: EnterWatchtowerUseCase,
    private val leaveWatchtowerUseCase: LeaveWatchtowerUseCase,
    private val shootUseCase: ShootUseCase,
    private val authorizationPort: AuthorizationPort,
) {
    @Get
    fun state(@PathVariable id: String, user: PortholePrincipal): HttpResponse<*> {
        val state = authorizationPort.accessSession(user.userId, UUID.fromString(id), SessionRole.VIEWER)
        return HttpResponse.ok(if (state.gameEnabled) state.gameState else GameState())
    }

    @Post("/watchtower/{elementId}/enter")
    fun enterWatchtower(
        @PathVariable id: String,
        @PathVariable elementId: String,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            enterWatchtowerUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(elementId),
            )
        )

    @Post("/watchtower/{elementId}/leave")
    fun leaveWatchtower(
        @PathVariable id: String,
        @PathVariable elementId: String,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            leaveWatchtowerUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(elementId),
            )
        )

    @Post("/shoot")
    fun shoot(
        @PathVariable id: String,
        @Body request: ShootRequest,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            shootUseCase.execute(
                UUID.fromString(id),
                user.userId,
                Vec3(request.originX, request.originY, request.originZ),
                Vec3(request.dirX, request.dirY, request.dirZ),
            )
        )
}
