package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import team.dedica.porthole.adapter.`in`.web.dto.EditTileRequest
import team.dedica.porthole.application.session.landscaping.EditTileUseCase
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.Terrain

@RestController
@RequestMapping("/api/maps/{id}/tiles")
class TileController(
    private val editTileUseCase: EditTileUseCase,
) {
    @PatchMapping("/{q}/{r}")
    fun editTile(
        @PathVariable id: String,
        @PathVariable q: Int,
        @PathVariable r: Int,
        @RequestBody request: EditTileRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> {
        val terrain = request.terrain?.let {
            runCatching { Terrain.valueOf(it.uppercase()) }
                .getOrElse { return ResponseEntity.badRequest().body("Unknown terrain: $it") }
        }
        return ResponseEntity.ok(editTileUseCase.execute(id, user.username, HexCoordinate(q, r), request.elevation, terrain))
    }
}

