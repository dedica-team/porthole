package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.AdminService
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.collaboration.AcceptJoinRequestUseCase
import team.dedica.porthole.application.session.collaboration.RemoveCollaboratorUseCase
import team.dedica.porthole.application.lobby.AdminJoinMapUseCase
import team.dedica.porthole.application.lobby.CreateMapUseCase
import team.dedica.porthole.application.session.metrics.CreateUnpositionedLandmarkUseCase
import team.dedica.porthole.application.session.collaboration.DeclineJoinRequestUseCase
import team.dedica.porthole.application.lobby.DeleteMapUseCase
import team.dedica.porthole.application.session.landscaping.ChangeLandmarkOwnerUseCase
import team.dedica.porthole.application.session.landscaping.EditLandmarkUseCase
import team.dedica.porthole.application.session.landscaping.EditMapUseCase
import team.dedica.porthole.application.lobby.GetMapUseCase
import team.dedica.porthole.application.lobby.JoinMapUseCase
import team.dedica.porthole.application.lobby.ListMapsUseCase
import team.dedica.porthole.application.session.landscaping.PlaceLandmarkUseCase
import team.dedica.porthole.application.session.landscaping.PositionLandmarkUseCase
import team.dedica.porthole.application.session.landscaping.RemoveLandmarkUseCase
import team.dedica.porthole.application.lobby.RequestJoinUseCase
import team.dedica.porthole.application.session.collaboration.SetCollaborationModeUseCase
import team.dedica.porthole.domain.CollaborationMode
import team.dedica.porthole.domain.HexCoordinate
import team.dedica.porthole.domain.LandmarkType
import org.springframework.http.HttpHeaders
import org.springframework.security.access.AccessDeniedException
import java.util.UUID

@RestController
@RequestMapping("/api/sessions")
class MapController(
    private val createMapUseCase: CreateMapUseCase,
    private val joinMapUseCase: JoinMapUseCase,
    private val adminJoinMapUseCase: AdminJoinMapUseCase,
    private val deleteMapUseCase: DeleteMapUseCase,
    private val changeLandmarkOwnerUseCase: ChangeLandmarkOwnerUseCase,
    private val placeLandmarkUseCase: PlaceLandmarkUseCase,
    private val createUnpositionedLandmarkUseCase: CreateUnpositionedLandmarkUseCase,
    private val positionLandmarkUseCase: PositionLandmarkUseCase,
    private val removeLandmarkUseCase: RemoveLandmarkUseCase,
    private val editLandmarkUseCase: EditLandmarkUseCase,
    private val editMapUseCase: EditMapUseCase,
    private val getMapUseCase: GetMapUseCase,
    private val listMapsUseCase: ListMapsUseCase,
    private val setCollaborationModeUseCase: SetCollaborationModeUseCase,
    private val requestJoinUseCase: RequestJoinUseCase,
    private val acceptJoinRequestUseCase: AcceptJoinRequestUseCase,
    private val declineJoinRequestUseCase: DeclineJoinRequestUseCase,
    private val removeCollaboratorUseCase: RemoveCollaboratorUseCase,
    private val adminService: AdminService,
) {
    @PostMapping
    fun createMap(
        @AuthenticationPrincipal user: PortholePrincipal,
        @Valid @RequestBody(required = false) request: CreateMapRequest?,
    ) = ResponseEntity.ok(
        createMapUseCase.execute(
            user.userId,
            request?.mapType ?: "LAND",
            request?.mapSize ?: "MEDIUM"
        )
    )

    @GetMapping
    fun listMaps(@AuthenticationPrincipal user: PortholePrincipal?) =
        ResponseEntity.ok(listMapsUseCase.execute(user?.userId))

    @GetMapping("/{id}")
    fun getMap(@PathVariable id: String, @AuthenticationPrincipal user: PortholePrincipal) =
        ResponseEntity.ok(getMapUseCase.execute(UUID.fromString(id), user.userId))

    @DeleteMapping("/{id}")
    fun deleteMap(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Void> {
        deleteMapUseCase.execute(UUID.fromString(id), user.userId)
        return ResponseEntity.noContent().build()
    }

    @GetMapping("/{id}/export")
    fun exportMap(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> {
        if (!adminService.isAdmin(user.userId)) throw AccessDeniedException("Only admins can export sessions")
        val state = getMapUseCase.execute(UUID.fromString(id), user.userId)
        return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"session-$id.json\"")
            .body(state)
    }

    @PostMapping("/{id}/admin-join")
    fun adminJoinMap(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(adminJoinMapUseCase.execute(UUID.fromString(id), user.userId))

    @DeleteMapping("/{id}/collaborators/{collaboratorId}")
    fun removeCollaborator(
        @PathVariable id: String,
        @PathVariable collaboratorId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(
        removeCollaboratorUseCase.execute(UUID.fromString(id), user.userId, UUID.fromString(collaboratorId))
    )

    @PatchMapping("/{id}/landmarks/{landmarkId}/owner")
    fun changeLandmarkOwner(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @Valid @RequestBody request: ChangeLandmarkOwnerRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(
        changeLandmarkOwnerUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(landmarkId),
            request.ownerId?.let { UUID.fromString(it) })
    )

    @PatchMapping("/{id}")
    fun editMap(
        @PathVariable id: String,
        @Valid @RequestBody request: EditMapRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(editMapUseCase.execute(UUID.fromString(id), user.userId, request.name, request.description))

    @PostMapping("/{id}/join")
    fun joinMap(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(joinMapUseCase.execute(UUID.fromString(id), user.userId))

    @PatchMapping("/{id}/collaboration-mode")
    fun setCollaborationMode(
        @PathVariable id: String,
        @Valid @RequestBody request: SetCollaborationModeRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> {
        val mode = runCatching { CollaborationMode.valueOf(request.mode.uppercase()) }
            .getOrElse { return ResponseEntity.badRequest().body("Unknown collaboration mode: ${request.mode}") }
        return ResponseEntity.ok(setCollaborationModeUseCase.execute(UUID.fromString(id), user.userId, mode))
    }

    @PostMapping("/{id}/join-requests")
    fun requestJoin(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(requestJoinUseCase.execute(UUID.fromString(id), user.userId))

    @PostMapping("/{id}/join-requests/{requestId}/accept")
    fun acceptJoinRequest(
        @PathVariable id: String,
        @PathVariable requestId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(
        acceptJoinRequestUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(requestId)
        )
    )

    @PostMapping("/{id}/join-requests/{requestId}/decline")
    fun declineJoinRequest(
        @PathVariable id: String,
        @PathVariable requestId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(
        declineJoinRequestUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(requestId)
        )
    )

    @PostMapping("/{id}/landmarks")
    fun placeLandmark(
        @PathVariable id: String,
        @Valid @RequestBody request: PlaceLandmarkRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> {
        val type = runCatching { LandmarkType.valueOf(request.type.uppercase()) }
            .getOrElse { return ResponseEntity.badRequest().body("Unknown landmark type: ${request.type}") }
        return ResponseEntity.ok(
            placeLandmarkUseCase.execute(
                UUID.fromString(id),
                user.userId,
                HexCoordinate(request.q, request.r),
                request.name,
                type
            )
        )
    }

    @PostMapping("/{id}/landmarks/unpositioned")
    fun createUnpositionedLandmark(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateUnpositionedLandmarkRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> {
        val type = runCatching { LandmarkType.valueOf(request.type.uppercase()) }
            .getOrElse { return ResponseEntity.badRequest().body("Unknown landmark type: ${request.type}") }
        return ResponseEntity.ok(
            createUnpositionedLandmarkUseCase.execute(
                UUID.fromString(id),
                user.userId,
                request.name,
                type,
                request.description,
                UUID.fromString(request.groupId),
                request.link
            )
        )
    }

    @PatchMapping("/{id}/landmarks/{landmarkId}/position")
    fun positionLandmark(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @Valid @RequestBody request: PositionLandmarkRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(
        positionLandmarkUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(landmarkId),
            HexCoordinate(request.q, request.r)
        )
    )

    @DeleteMapping("/{id}/landmarks/{landmarkId}")
    fun removeLandmark(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = ResponseEntity.ok(removeLandmarkUseCase.execute(UUID.fromString(id), user.userId, UUID.fromString(landmarkId)))

    @PatchMapping("/{id}/landmarks/{landmarkId}")
    fun editLandmark(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @Valid @RequestBody request: EditLandmarkRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> {
        val type = request.type?.let {
            runCatching { LandmarkType.valueOf(it.uppercase()) }
                .getOrElse { return ResponseEntity.badRequest().body("Unknown landmark type: $it") }
        }
        return ResponseEntity.ok(
            editLandmarkUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(landmarkId),
                request.name,
                type,
                request.description,
                UUID.fromString(request.groupId),
                request.clearGroup,
                request.link,
                request.clearLink
            )
        )
    }
}
