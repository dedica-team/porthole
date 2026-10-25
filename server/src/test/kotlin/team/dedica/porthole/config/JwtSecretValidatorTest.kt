package team.dedica.porthole.config

import io.micronaut.context.BeanContext
import io.micronaut.context.env.Environment
import io.micronaut.context.event.StartupEvent
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.mockito.kotlin.doReturn
import org.mockito.kotlin.mock

class JwtSecretValidatorTest {

    private val defaultSecret = PortholeAuthProperties.Jwt.INSECURE_DEFAULT
    private val event = StartupEvent(mock<BeanContext>())

    private fun validator(secret: String, vararg activeEnvironments: String): JwtSecretValidator {
        val props = PortholeAuthPropertiesTestFactory.withJwt(secret = secret)
        val env = mock<Environment> {
            on { activeNames } doReturn activeEnvironments.toSet()
        }
        return JwtSecretValidator(props, env)
    }

    @Test
    fun `validate passes when secret is not the default`() {
        assertDoesNotThrow {
            validator("my-custom-secret-that-is-long-enough-for-hs256!!").validate(event)
        }
    }

    @Test
    fun `validate throws when default secret is used without dev environment`() {
        val ex = assertThrows(IllegalStateException::class.java) {
            validator(defaultSecret, "prod").validate(event)
        }
        assertTrue(ex.message!!.contains("PORTHOLE_JWT_SECRET"))
    }

    @Test
    fun `validate warns but does not throw when default secret is used with dev environment`() {
        assertDoesNotThrow {
            validator(defaultSecret, "dev").validate(event)
        }
    }

    @Test
    fun `validate warns but does not throw when default secret is used with test environment`() {
        assertDoesNotThrow {
            validator(defaultSecret, "test").validate(event)
        }
    }

    @Test
    fun `validate warns but does not throw when default secret is used with local environment`() {
        assertDoesNotThrow {
            validator(defaultSecret, "local").validate(event)
        }
    }

    @Test
    fun `validate throws when default secret is used with no active environments`() {
        val ex = assertThrows(IllegalStateException::class.java) {
            validator(defaultSecret).validate(event)
        }
        assertTrue(ex.message!!.contains("PORTHOLE_JWT_SECRET"))
    }
}
