package team.dedica.porthole.adapter.`in`.web

import io.micronaut.http.HttpResponse
import io.micronaut.http.annotation.*
import jakarta.validation.Valid
import team.dedica.porthole.adapter.`in`.web.dto.*
import team.dedica.porthole.adapter.`in`.web.security.PortholePrincipal
import team.dedica.porthole.application.session.processes.*
import java.util.*

@Controller("/api/sessions/{id}/processes")
class ProcessController(
    private val listProcessesUseCase: ListProcessesUseCase,
    private val createProcessUseCase: CreateProcessUseCase,
    private val editProcessUseCase: EditProcessUseCase,
    private val saveProcessUseCase: SaveProcessUseCase,
    private val removeProcessUseCase: RemoveProcessUseCase,
    private val addProcessStageUseCase: AddProcessStageUseCase,
    private val editProcessStageUseCase: EditProcessStageUseCase,
    private val reorderProcessStagesUseCase: ReorderProcessStagesUseCase,
    private val removeProcessStageUseCase: RemoveProcessStageUseCase,
    private val addStageConnectionUseCase: AddStageConnectionUseCase,
    private val editStageConnectionUseCase: EditStageConnectionUseCase,
    private val removeStageConnectionUseCase: RemoveStageConnectionUseCase,
) {

    @Get
    fun listProcesses(
        @PathVariable id: String,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(listProcessesUseCase.execute(UUID.fromString(id), user.userId))

    @Post
    fun createProcess(
        @PathVariable id: String,
        @Valid @Body request: CreateProcessRequest,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            createProcessUseCase.execute(
                UUID.fromString(id),
                request.name,
                request.description,
                user.userId
            )
        )

    @Put("/{processId}")
    fun saveProcess(
        @PathVariable id: String,
        @PathVariable processId: String,
        @Valid @Body request: SaveProcessRequest,
        user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            saveProcessUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                request.name,
                request.description,
                request.stages,
                user.userId
            )
        )

    @Patch("/{processId}")
    fun editProcess(
        @PathVariable id: String,
        @PathVariable processId: String,
        @Valid @Body request: EditProcessRequest,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            editProcessUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                request.name,
                request.description,
                user.userId
            )
        )

    @Delete("/{processId}")
    fun removeProcess(
        @PathVariable id: String,
        @PathVariable processId: String,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(removeProcessUseCase.execute(
            UUID.fromString(id),
            UUID.fromString(processId),
            user.userId
        ))

    @Post("/{processId}/stages")
    fun addStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @Valid @Body request: CreateProcessStageRequest,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            addProcessStageUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                request.name,
                request.order,
                user.userId
            )
        )

    @Post("/{processId}/stages/reorder")
    fun reorderStages(
        @PathVariable id: String,
        @PathVariable processId: String,
        @Body request: ReorderProcessStagesRequest,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            reorderProcessStagesUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                request.stageIds.map { UUID.fromString(it) },
                user.userId
            )
        )

    @Delete("/{processId}/stages/{stageId}")
    fun removeStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            removeProcessStageUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                UUID.fromString(stageId),
                user.userId
            )
        )

    @Patch("/{processId}/stages/{stageId}")
    fun editStage(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @Valid @Body request: EditProcessStageRequest,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
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

    @Post("/{processId}/stages/{stageId}/connections")
    fun addStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @Body request: AddStageConnectionRequest,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
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

    @Patch("/{processId}/stages/{stageId}/connections/{stageConnId}")
    fun editStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @PathVariable stageConnId: String,
        @Body request: EditStageConnectionRequest,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
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

    @Delete("/{processId}/stages/{stageId}/connections/{stageConnId}")
    fun removeStageConnection(
        @PathVariable id: String,
        @PathVariable processId: String,
        @PathVariable stageId: String,
        @PathVariable stageConnId: String,
         user: PortholePrincipal,
    ): HttpResponse<*> =
        HttpResponse.ok(
            removeStageConnectionUseCase.execute(
                UUID.fromString(id),
                UUID.fromString(processId),
                UUID.fromString(stageId),
                UUID.fromString(stageConnId),
                user.userId
            )
        )
}
