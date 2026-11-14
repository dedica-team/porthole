package team.dedica.porthole.adapter.`in`.web

import tools.jackson.databind.exc.InvalidFormatException
import io.micronaut.context.annotation.Primary
import io.micronaut.http.HttpRequest
import io.micronaut.http.HttpResponse
import io.micronaut.http.HttpStatus
import io.micronaut.http.exceptions.HttpStatusException
import io.micronaut.http.server.exceptions.ExceptionHandler
import io.micronaut.json.JsonSyntaxException
import jakarta.inject.Singleton
import jakarta.validation.ConstraintViolationException
import org.slf4j.LoggerFactory
import team.dedica.porthole.domain.AccessDeniedException


data class ErrorResponse(val message: String, val status: Int)

/**
 * Maps domain rule violations thrown by use cases to meaningful HTTP responses
 * with a JSON body so the frontend can display the error message directly.
 *
 * - [IllegalArgumentException]          → 400 Bad Request  (rule violated, e.g. not adjacent)
 * - [IllegalStateException]             → 409 Conflict     (invalid state, e.g. tower already exists)
 * - [NoSuchElementException]            → 404 Not Found    (map / tile does not exist)
 * - [IllegalAccessException]            → 403 Forbidden
 * - [AccessDeniedException]             → 403 Forbidden
 * - [ConstraintViolationException]     → 400 Bad Request  (bean validation failed)
 * - [JsonSyntaxException]               → 400 Bad Request  (unknown enum value in JSON body)
 * - [Exception]                         → 500              (unexpected – logged, never crashes)
 */
@Singleton
class BadRequestExceptionHandler : ExceptionHandler<IllegalArgumentException, HttpResponse<ErrorResponse>> {
    private val log = LoggerFactory.getLogger(BadRequestExceptionHandler::class.java)

    override fun handle(request: HttpRequest<*>, exception: IllegalArgumentException): HttpResponse<ErrorResponse> {
        log.warn("Bad request: {}", exception.message)
        return HttpResponse.status<ErrorResponse>(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(exception.message ?: "Invalid request", HttpStatus.BAD_REQUEST.code))
    }
}

@Singleton
class ConflictExceptionHandler : ExceptionHandler<IllegalStateException, HttpResponse<ErrorResponse>> {
    private val log = LoggerFactory.getLogger(ConflictExceptionHandler::class.java)

    override fun handle(request: HttpRequest<*>, exception: IllegalStateException): HttpResponse<ErrorResponse> {
        log.warn("Conflict: {}", exception.message)
        return HttpResponse.status<ErrorResponse>(HttpStatus.CONFLICT)
            .body(ErrorResponse(exception.message ?: "Conflict", HttpStatus.CONFLICT.code))
    }
}

@Singleton
class NotFoundExceptionHandler : ExceptionHandler<NoSuchElementException, HttpResponse<ErrorResponse>> {
    private val log = LoggerFactory.getLogger(NotFoundExceptionHandler::class.java)

    override fun handle(request: HttpRequest<*>, exception: NoSuchElementException): HttpResponse<ErrorResponse> {
        log.warn("Not found: {}", exception.message)
        return HttpResponse.status<ErrorResponse>(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(exception.message ?: "Not found", HttpStatus.NOT_FOUND.code))
    }
}

@Singleton
class ForbiddenExceptionHandler : ExceptionHandler<IllegalAccessException, HttpResponse<ErrorResponse>> {
    private val log = LoggerFactory.getLogger(ForbiddenExceptionHandler::class.java)

    override fun handle(request: HttpRequest<*>, exception: IllegalAccessException): HttpResponse<ErrorResponse> {
        log.warn("Forbidden: {}", exception.message)
        return HttpResponse.status<ErrorResponse>(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(exception.message ?: "Forbidden", HttpStatus.FORBIDDEN.code))
    }
}

@Singleton
class AccessDeniedExceptionHandler : ExceptionHandler<AccessDeniedException, HttpResponse<ErrorResponse>> {
    private val log = LoggerFactory.getLogger(AccessDeniedExceptionHandler::class.java)

    override fun handle(request: HttpRequest<*>, exception: AccessDeniedException): HttpResponse<ErrorResponse> {
        log.warn("Access denied: {}", exception.message)
        return HttpResponse.status<ErrorResponse>(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(exception.message ?: "Forbidden", HttpStatus.FORBIDDEN.code))
    }
}

/** Handles @Valid constraint violations on request DTOs. */
@Primary
@Singleton
class ValidationExceptionHandler : ExceptionHandler<ConstraintViolationException, HttpResponse<ErrorResponse>> {
    private val log = LoggerFactory.getLogger(ValidationExceptionHandler::class.java)

    override fun handle(request: HttpRequest<*>, exception: ConstraintViolationException): HttpResponse<ErrorResponse> {
        log.warn("Validation failed: {}", exception.message)
        val message = constraintMessage(exception)
        return HttpResponse.status<ErrorResponse>(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(message, HttpStatus.BAD_REQUEST.code))
    }

    private fun constraintMessage(exception: ConstraintViolationException): String {
        val violations = exception.constraintViolations
        if (violations.isNullOrEmpty()) return exception.message ?: "Validation failed"
        return violations.joinToString("; ") { "${it.propertyPath}: ${it.message}" }
    }
}

/** Catches JSON deserialization failures for unknown / removed enum values. */
@Singleton
class JsonSyntaxExceptionHandler : ExceptionHandler<JsonSyntaxException, HttpResponse<ErrorResponse>> {
    private val log = LoggerFactory.getLogger(JsonSyntaxExceptionHandler::class.java)

    override fun handle(request: HttpRequest<*>, exception: JsonSyntaxException): HttpResponse<ErrorResponse> {
        log.warn("Unreadable message: {}", exception.message)
        val invalid = generateSequence<Throwable>(exception.cause) { it.cause }
            .filterIsInstance<InvalidFormatException>()
            .firstOrNull()
        val message = if (invalid != null && invalid.targetType.isEnum) {
            "Unknown value '${invalid.value}' for type ${invalid.targetType.simpleName}"
        } else {
            "Malformed request body"
        }
        return HttpResponse.status<ErrorResponse>(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(message, HttpStatus.BAD_REQUEST.code))
    }
}

/** Safety net – prevents unhandled exceptions from leaking stack traces. */
@Singleton
class UnexpectedExceptionHandler : ExceptionHandler<Exception, HttpResponse<ErrorResponse>> {
    private val log = LoggerFactory.getLogger(UnexpectedExceptionHandler::class.java)

    override fun handle(request: HttpRequest<*>, exception: Exception): HttpResponse<ErrorResponse> {
        if (exception is HttpStatusException) {
            return HttpResponse.status<ErrorResponse>(exception.status)
                .body(ErrorResponse(exception.message ?: exception.status.reason, exception.status.code))
        }
        log.error("Unexpected error: ${exception.message}", exception)
        return HttpResponse.status<ErrorResponse>(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse("An unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR.code))
    }
}
