package team.dedica.porthole.adapter.`in`.web

import com.fasterxml.jackson.databind.exc.InvalidFormatException
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.security.access.AccessDeniedException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

data class ErrorResponse(val message: String, val status: Int)

/**
 * Maps domain rule violations thrown by use cases to meaningful HTTP responses
 * with a JSON body so the frontend can display the error message directly.
 *
 * - [IllegalArgumentException]          → 400 Bad Request  (rule violated, e.g. not adjacent)
 * - [IllegalStateException]             → 409 Conflict     (invalid state, e.g. tower already exists)
 * - [NoSuchElementException]            → 404 Not Found    (map / tile does not exist)
 * - [HttpMessageNotReadableException]   → 400 Bad Request  (unknown enum value in JSON body)
 * - [Exception]                         → 500              (unexpected – logged, never crashes)
 */
@RestControllerAdvice
class GlobalExceptionHandler {

    private val log = LoggerFactory.getLogger(GlobalExceptionHandler::class.java)

    @ExceptionHandler(IllegalArgumentException::class)
    fun handleBadRequest(ex: IllegalArgumentException): ResponseEntity<ErrorResponse> {
        log.error("Bad request: ${ex.message}", ex)
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(ex.message ?: "Invalid request", HttpStatus.BAD_REQUEST.value()))
    }

    @ExceptionHandler(IllegalStateException::class)
    fun handleConflict(ex: IllegalStateException): ResponseEntity<ErrorResponse> {
        log.error("Conflict: ${ex.message}", ex)
        return ResponseEntity
            .status(HttpStatus.CONFLICT)
            .body(ErrorResponse(ex.message ?: "Conflict", HttpStatus.CONFLICT.value()))
    }

    @ExceptionHandler(NoSuchElementException::class)
    fun handleNotFound(ex: NoSuchElementException): ResponseEntity<ErrorResponse> {
        log.error("Not found: ${ex.message}", ex)
        return ResponseEntity
            .status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse(ex.message ?: "Not found", HttpStatus.NOT_FOUND.value()))
    }

    /**
     * Catches Jackson deserialization failures for unknown / removed enum values
     * (e.g. a client sending "WELL" after it has been removed from LandmarkType).
     */
    @ExceptionHandler(HttpMessageNotReadableException::class)
    fun handleUnreadableMessage(ex: HttpMessageNotReadableException): ResponseEntity<ErrorResponse> {
        log.error("Unreadable message: ${ex.message}", ex)
        val cause = ex.cause
        val message = if (cause is InvalidFormatException && cause.targetType.isEnum) {
            "Unknown value '${cause.value}' for type ${cause.targetType.simpleName}"
        } else {
            "Malformed request body"
        }
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(message, HttpStatus.BAD_REQUEST.value()))
    }

    /** Safety net – prevents unhandled exceptions from leaking stack traces. */
    @ExceptionHandler(IllegalAccessException::class)
    fun handleForbidden(ex: IllegalAccessException): ResponseEntity<ErrorResponse> {
        log.error("Forbidden: ${ex.message}", ex)
        return ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(ex.message ?: "Forbidden", HttpStatus.FORBIDDEN.value()))
    }

    @ExceptionHandler(AccessDeniedException::class)
    fun handleAccessDenied(ex: AccessDeniedException): ResponseEntity<ErrorResponse> {
        log.warn("Access denied: ${ex.message}")
        return ResponseEntity
            .status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse(ex.message ?: "Forbidden", HttpStatus.FORBIDDEN.value()))
    }

    /** Handles @Valid / @Validated constraint violations on request DTOs. */
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(ex: MethodArgumentNotValidException): ResponseEntity<ErrorResponse> {
        log.error("Validation failed: ${ex.message}", ex)
        val message = ex.bindingResult.fieldErrors
            .joinToString("; ") { "${it.field}: ${it.defaultMessage}" }
            .ifBlank { "Validation failed" }
        return ResponseEntity
            .status(HttpStatus.BAD_REQUEST)
            .body(ErrorResponse(message, HttpStatus.BAD_REQUEST.value()))
    }

    @ExceptionHandler(Exception::class)
    fun handleUnexpected(ex: Exception): ResponseEntity<ErrorResponse> {
        log.error("Unexpected error: ${ex.message}", ex)
        return ResponseEntity
            .status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse("An unexpected error occurred", HttpStatus.INTERNAL_SERVER_ERROR.value()))
    }
}

