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
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.collaboration.AcceptJoinRequestUseCase
import team.dedica.porthole.application.session.collaboration.RemoveCollaboratorUseCase
import team.dedica.porthole.application.lobby.AdminJoinMapUseCase
import team.dedica.porthole.application.lobby.CreateMapUseCase
import team.dedica.porthole.application.port.AuthorizationPort
import team.dedica.porthole.application.session.metrics.CreateUnpositionedLandmarkUseCase
import team.dedica.porthole.application.session.collaboration.DeclineJoinRequestUseCase
import team.dedica.porthole.application.lobby.DeleteMapUseCase
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
import team.dedica.porthole.domain.SessionRole
import io.micronaut.http.HttpHeaders
import java.util.UUID

@Controller("/api/sessions")
class SessionController(
    private val createMapUseCase: CreateMapUseCase,
    private val joinMapUseCase: JoinMapUseCase,
    private val adminJoinMapUseCase: AdminJoinMapUseCase,
    private val deleteMapUseCase: DeleteMapUseCase,
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
    private val authorizationPort: AuthorizationPort,
) {
    @Post
    fun createMap(
        @AuthenticationPrincipal user: PortholePrincipal,
        @Valid @Body request: CreateMapRequest?,
    ) = HttpResponse.ok(
        createMapUseCase.execute(
            user.userId,
            request?.mapType ?: "LAND",
            request?.mapSize ?: "MEDIUM"
        )
    )

    @Get
    fun listMaps(@AuthenticationPrincipal user: PortholePrincipal?) =
        HttpResponse.ok(listMapsUseCase.execute(user?.userId))

    @Get("/{id}")
    fun getMap(@PathVariable id: String, @AuthenticationPrincipal user: PortholePrincipal) =
        HttpResponse.ok(getMapUseCase.execute(UUID.fromString(id), user.userId))

    @Delete("/{id}")
    fun deleteMap(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> {
        deleteMapUseCase.execute(UUID.fromString(id), user.userId)
        return HttpResponse.noContent<Any>()
    }

    @Get("/{id}/export")
    fun exportMap(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> {
        val sessionId = UUID.fromString(id)
        val state = authorizationPort.accessSession(user.userId, sessionId, SessionRole.COLLABORATOR)
        return HttpResponse.ok(state)
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"session-$id.json\"")
    }

    @Post("/{id}/admin-join")
    fun adminJoinMap(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(adminJoinMapUseCase.execute(UUID.fromString(id), user.userId))

    @Delete("/{id}/collaborators/{collaboratorId}")
    fun removeCollaborator(
        @PathVariable id: String,
        @PathVariable collaboratorId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(
        removeCollaboratorUseCase.execute(UUID.fromString(id), user.userId, UUID.fromString(collaboratorId))
    )

    @Patch("/{id}")
    fun editMap(
        @PathVariable id: String,
        @Valid @Body request: EditMapRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(editMapUseCase.execute(UUID.fromString(id), user.userId, request.name, request.description))

    @Post("/{id}/join")
    fun joinMap(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(joinMapUseCase.execute(UUID.fromString(id), user.userId))

    @Patch("/{id}/collaboration-mode")
    fun setCollaborationMode(
        @PathVariable id: String,
        @Valid @Body request: SetCollaborationModeRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> {
        val mode = runCatching { CollaborationMode.valueOf(request.mode.uppercase()) }
            .getOrElse { return HttpResponse.badRequest("Unknown collaboration mode: ${request.mode}") }
        return HttpResponse.ok(setCollaborationModeUseCase.execute(UUID.fromString(id), user.userId, mode))
    }

    @Post("/{id}/join-requests")
    fun requestJoin(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(requestJoinUseCase.execute(UUID.fromString(id), user.userId))

    @Post("/{id}/join-requests/{requestId}/accept")
    fun acceptJoinRequest(
        @PathVariable id: String,
        @PathVariable requestId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(
        acceptJoinRequestUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(requestId)
        )
    )

    @Post("/{id}/join-requests/{requestId}/decline")
    fun declineJoinRequest(
        @PathVariable id: String,
        @PathVariable requestId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(
        declineJoinRequestUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(requestId)
        )
    )

    @Post("/{id}/landmarks")
    fun placeLandmark(
        @PathVariable id: String,
        @Valid @Body request: PlaceLandmarkRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> {
        val type = runCatching { LandmarkType.valueOf(request.type.uppercase()) }
            .getOrElse { return HttpResponse.badRequest("Unknown landmark type: ${request.type}") }
        return HttpResponse.ok(
            placeLandmarkUseCase.execute(
                UUID.fromString(id),
                user.userId,
                HexCoordinate(request.q, request.r),
                request.name,
                type
            )
        )
    }

    @Post("/{id}/landmarks/unpositioned")
    fun createUnpositionedLandmark(
        @PathVariable id: String,
        @Valid @Body request: CreateUnpositionedLandmarkRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> {
        val type = runCatching { LandmarkType.valueOf(request.type.uppercase()) }
            .getOrElse { return HttpResponse.badRequest("Unknown landmark type: ${request.type}") }
        return HttpResponse.ok(
            createUnpositionedLandmarkUseCase.execute(
                UUID.fromString(id),
                user.userId,
                request.name,
                type,
                request.description,
                request.groupId?.let { UUID.fromString(it) },
                request.link
            )
        )
    }

    @Patch("/{id}/landmarks/{landmarkId}/position")
    fun positionLandmark(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @Valid @Body request: PositionLandmarkRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(
        positionLandmarkUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(landmarkId),
            HexCoordinate(request.q, request.r)
        )
    )

    @Delete("/{id}/landmarks/{landmarkId}")
    fun removeLandmark(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ) = HttpResponse.ok(
        removeLandmarkUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(landmarkId)
        )
    )

    @Patch("/{id}/landmarks/{landmarkId}")
    fun editLandmark(
        @PathVariable id: String,
        @PathVariable landmarkId: String,
        @Valid @Body request: EditLandmarkRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): HttpResponse<*> {
        val type = request.type?.let {
            runCatching { LandmarkType.valueOf(it.uppercase()) }
                .getOrElse { return HttpResponse.badRequest("Unknown landmark type: $it") }
        }
        return HttpResponse.ok(
            editLandmarkUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(landmarkId),
                request.name,
                type,
                request.description,
                request.groupId?.let { UUID.fromString(it) },
                request.clearGroup,
                request.link,
                request.clearLink,
                request.ownerId?.let { UUID.fromString(it) },
                request.clearOwner,
            )
        )
    }
}
