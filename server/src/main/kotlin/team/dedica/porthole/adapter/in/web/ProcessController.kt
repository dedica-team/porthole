package team.dedica.porthole.adapter.`in`.web

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.*
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.processes.*
import java.util.UUID

@RestController
@RequestMapping("/api/maps/{id}/processes")
class ProcessController(
    private val listProcessesUseCase: ListProcessesUseCase,
    private val createProcessUseCase: CreateProcessUseCase,
    private val editProcessUseCase: EditProcessUseCase,
    private val removeProcessUseCase: RemoveProcessUseCase,
    private val addProcessStageUseCase: AddProcessStageUseCase,
    private val editProcessStageUseCase: EditProcessStageUseCase,
    private val reorderProcessStagesUseCase: ReorderProcessStagesUseCase,
    private val removeProcessStageUseCase: RemoveProcessStageUseCase,
    private val addStageConnectionUseCase: AddStageConnectionUseCase,
    private val editStageConnectionUseCase: EditStageConnectionUseCase,
    private val removeStageConnectionUseCase: RemoveStageConnectionUseCase,
) {

    @GetMapping
    fun listProcesses(
        @PathVariable id: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(listProcessesUseCase.execute(UUID.fromString(id), user.userId))

    @PostMapping
    fun createProcess(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateProcessRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            createProcessUseCase.execute(
                UUID.fromString(id),
                request.name,
                request.description,
                user.userId
            )
        )

    @PatchMapping("/{processId}")
    fun editProcess(
        @PathVariable id: String,
        @PathVariable processId: String,
        @Valid @RequestBody request: EditProcessRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            editProcessUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                request.name,
                request.description,
                user.userId
            )
        )

    @DeleteMapping("/{processId}")
    fun removeProcess(
        @PathVariable id: String,
        @PathVariable processId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(removeProcessUseCase.execute(
            UUID.fromString(id),
            UUID.fromString(processId),
            user.userId
        ))

    @PostMapping("/{processId}/stages")
    fun addStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @Valid @RequestBody request: CreateProcessStageRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            addProcessStageUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                request.name,
                request.order,
                user.userId
            )
        )

    @PostMapping("/{processId}/stages/reorder")
    fun reorderStages(
        @PathVariable id: String,
        @PathVariable processId: String,
        @RequestBody request: ReorderProcessStagesRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            reorderProcessStagesUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                request.stageIds.map { UUID.fromString(it) },
                user.userId
            )
        )

    @DeleteMapping("/{processId}/stages/{stageId}")
    fun removeStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            removeProcessStageUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                UUID.fromString(stageId),
                user.userId
            )
        )

    @PatchMapping("/{processId}/stages/{stageId}")
    fun editStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @Valid @RequestBody request: EditProcessStageRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            editProcessStageUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                UUID.fromString(stageId),
                request.name,
                request.clearName,
                request.order,
                user.userId,
            )
        )

    @PostMapping("/{processId}/stages/{stageId}/connections")
    fun addStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @RequestBody request: AddStageConnectionRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            addStageConnectionUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                UUID.fromString(stageId),
                UUID.fromString(request.connectionId),
                request.title,
                request.direction,
                user.userId,
            )
        )

    @PatchMapping("/{processId}/stages/{stageId}/connections/{stageConnId}")
    fun editStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @PathVariable stageConnId: String,
        @RequestBody request: EditStageConnectionRequest,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            editStageConnectionUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                UUID.fromString(stageId),
                UUID.fromString(stageConnId),
                request.title,
                request.clearTitle,
                request.direction,
                user.userId,
            )
        )

    @DeleteMapping("/{processId}/stages/{stageId}/connections/{stageConnId}")
    fun removeStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @PathVariable stageConnId: String,
        @AuthenticationPrincipal user: PortholePrincipal,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            removeStageConnectionUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                UUID.fromString(stageId),
                UUID.fromString(stageConnId),
                user.userId
            )
        )
}
