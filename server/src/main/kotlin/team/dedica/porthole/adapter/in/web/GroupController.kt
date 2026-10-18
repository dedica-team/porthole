package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.CreateGroupRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditGroupRequest
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.metrics.CreateGroupUseCase
import team.dedica.porthole.application.session.metrics.EditGroupUseCase
import team.dedica.porthole.application.session.metrics.RemoveGroupUseCase
import java.util.*

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
         user: PortholePrincipal
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
         user: PortholePrincipal
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
         user: PortholePrincipal
    ): HttpResponse<*> =
        HttpResponse.ok(removeGroupUseCase.execute(
            UUID.fromString(id),
            user.userId,
            UUID.fromString(groupId)
        ))
}
