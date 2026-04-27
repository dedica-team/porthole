package team.dedica.porthole.adapter.`in`.web

import jakarta.validation.Valid
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.core.userdetails.UserDetails
import org.springframework.web.bind.annotation.*
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.application.session.processes.*

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
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(listProcessesUseCase.execute(id, user.username))

    @PostMapping
    fun createProcess(
        @PathVariable id: String,
        @Valid @RequestBody request: CreateProcessRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(createProcessUseCase.execute(id, request.name, request.description, user.username))

    @PatchMapping("/{processId}")
    fun editProcess(
        @PathVariable id: String,
        @PathVariable processId: String,
        @Valid @RequestBody request: EditProcessRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(editProcessUseCase.execute(id, processId, request.name, request.description, user.username))

    @DeleteMapping("/{processId}")
    fun removeProcess(
        @PathVariable id: String,
        @PathVariable processId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(removeProcessUseCase.execute(id, processId, user.username))

    @PostMapping("/{processId}/stages")
    fun addStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @Valid @RequestBody request: CreateProcessStageRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(addProcessStageUseCase.execute(id, processId, request.name, request.order, user.username))

    @PostMapping("/{processId}/stages/reorder")
    fun reorderStages(
        @PathVariable id: String,
        @PathVariable processId: String,
        @RequestBody request: ReorderProcessStagesRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(reorderProcessStagesUseCase.execute(id, processId, request.stageIds, user.username))

    @DeleteMapping("/{processId}/stages/{stageId}")
    fun removeStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(removeProcessStageUseCase.execute(id, processId, stageId, user.username))

    @PatchMapping("/{processId}/stages/{stageId}")
    fun editStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @Valid @RequestBody request: EditProcessStageRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            editProcessStageUseCase.execute(
                id, processId, stageId,
                request.name, request.clearName, request.order,
                user.username,
            )
        )

    @PostMapping("/{processId}/stages/{stageId}/connections")
    fun addStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @RequestBody request: AddStageConnectionRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            addStageConnectionUseCase.execute(
                id, processId, stageId,
                request.connectionId, request.title, request.direction,
                user.username,
            )
        )

    @PatchMapping("/{processId}/stages/{stageId}/connections/{stageConnId}")
    fun editStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @PathVariable stageConnId: String,
        @RequestBody request: EditStageConnectionRequest,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(
            editStageConnectionUseCase.execute(
                id, processId, stageId, stageConnId,
                request.title, request.clearTitle, request.direction,
                user.username,
            )
        )

    @DeleteMapping("/{processId}/stages/{stageId}/connections/{stageConnId}")
    fun removeStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @PathVariable stageConnId: String,
        @AuthenticationPrincipal user: UserDetails,
    ): ResponseEntity<Any> =
        ResponseEntity.ok(removeStageConnectionUseCase.execute(id, processId, stageId, stageConnId, user.username))
}
