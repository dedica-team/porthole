package team.dedica.porthole.adapter.`in`.web

import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.CreateGroupRequest
import team.dedica.porthole.adapter.`in`.web.dto.EditGroupRequest
import team.dedica.porthole.application.session.metrics.CreateGroupUseCase
import team.dedica.porthole.application.session.metrics.EditGroupUseCase
import team.dedica.porthole.application.session.metrics.RemoveGroupUseCase
import java.util.UUID

@RestController
@RequestMapping("/api/maps/{id}/groups")
class GroupController(
    private val createGroupUseCase: CreateGroupUseCase,
    private val editGroupUseCase: EditGroupUseCase,
    private val removeGroupUseCase: RemoveGroupUseCase,
) {
    @PostMapping
    fun createGroup(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateGroupRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<*> = ResponseEntity.ok(
        createGroupUseCase.execute(
            UUID.fromString(id), user.username, request.name, request.color, request.description, request.link
        )
    )

    @PatchMapping("/{groupId}")
    fun editGroup(
        @PathVariable id: String,
        @PathVariable groupId: String,
        @Valid @RequestBody request: EditGroupRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<*> = ResponseEntity.ok(
        editGroupUseCase.execute(
            UUID.fromString(id),
            user.username,
            UUID.fromString(groupId),
            request.name,
            request.color,
            request.description,
            request.clearDescription,
            request.link,
            request.clearLink,
        )
    )

    @DeleteMapping("/{groupId}")
    fun removeGroup(
        @PathVariable id: String,
        @PathVariable groupId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<*> =
        ResponseEntity.ok(removeGroupUseCase.execute(UUID.fromString(id), user.username, UUID.fromString(groupId)))
}

