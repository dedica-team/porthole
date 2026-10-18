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
import team.dedica.porthole.application.session.metrics.*
import java.util.UUID

@Controller("/api/sessions/{id}/groups")
class GroupController(
    private val createGroupUseCase: CreateGroupUseCase,
    private val editGroupUseCase: EditGroupUseCase,
    private val removeGroupUseCase: RemoveGroupUseCase,
) {
    @Post
    fun createGroup(
        @PathVariable id: String,
        @Valid @Body request: CreateGroupRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            createGroupUseCase.execute(
                UUID.fromString(id),
                user.userId,
                request.name,
                request.color,
                request.description,
                request.link
            )
        )

    @Patch("/{groupId}")
    fun editGroup(
        @PathVariable id: String,
        @PathVariable groupId: String,
        @Valid @Body request: EditGroupRequest,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(
            editGroupUseCase.execute(
                UUID.fromString(id),
                user.userId,
                UUID.fromString(groupId),
                request.name,
                request.color,
                request.description,
                request.clearDescription,
                request.link,
                request.clearLink
            )
        )

    @Delete("/{groupId}")
    fun removeGroup(
        @PathVariable id: String,
        @PathVariable groupId: String,
        @AuthenticationPrincipal user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(removeGroupUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(groupId)
        ))
}
