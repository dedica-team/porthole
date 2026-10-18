package team.dedica.porthole.adapter.`in`.web

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
import team.dedica.porthole.adapter.`in`.web.dto.EditTileRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.landscaping.EditTileUseCase
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.Terrain
import java.util.UUID

@Controller("/api/sessions/{id}/tiles")
class TileController(
    private val editTileUseCase: EditTileUseCase,
) {
    @Patch("/{q}/{r}")
    fun editTile(
        @PathVariable id: String,
        @PathVariable q: Int,
        @PathVariable r: Int,
        @Body request: EditTileRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> {
        val terrain = request.terrain?.let {
            runCatching { Terrain.valueOf(it.uppercase()) }
                .getOrElse { return HttpResponse.badRequest("Unknown terrain: $it") }
        }
        return HttpResponse.ok(
            editTileUseCase.execute(
                UUID.fromString(id),
                user.userId,
                HexCoordinate(q, r),
                request.elevation,
                terrain
            )
        )
    }
}
