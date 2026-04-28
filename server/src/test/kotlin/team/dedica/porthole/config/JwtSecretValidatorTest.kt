package team.dedica.porthole.config

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import org.springframework.mock.env.MockEnvironment

class JwtSecretValidatorTest {

    private val defaultSecret = PortholeAuthProperties.Jwt.INSECURE_DEFAULT

    private fun validator(secret: String, vararg profiles: String): JwtSecretValidator {
        val props = PortholeAuthPropertiesTestFactory.withJwt(secret = secret)
        val env = MockEnvironment().apply { setActiveProfiles(*profiles) }
        return JwtSecretValidator(props, env)
    }

    @Test
    fun `validate passes when secret is not the default`() {
        assertDoesNotThrow {
            validator("my-custom-secret-that-is-long-enough-for-hs256!!").validate()
        }
    }

    @Test
    fun `validate throws when default secret is used without dev profile`() {
        val ex = assertThrows(IllegalStateException::class.java) {
            validator(defaultSecret, "prod").validate()
        }
        assertTrue(ex.message!!.contains("PORTHOLE_JWT_SECRET"))
    }

    @Test
    fun `validate warns but does not throw when default secret is used with dev profile`() {
        assertDoesNotThrow {
            validator(defaultSecret, "dev").validate()
        }
    }

    @Test
    fun `validate warns but does not throw when default secret is used with test profile`() {
        assertDoesNotThrow {
            validator(defaultSecret, "test").validate()
        }
    }

    @Test
    fun `validate warns but does not throw when default secret is used with local profile`() {
        assertDoesNotThrow {
            validator(defaultSecret, "local").validate()
        }
    }

    @Test
    fun `validate throws when default secret is used with no active profiles`() {
        val ex = assertThrows(IllegalStateException::class.java) {
            validator(defaultSecret).validate()
        }
        assertTrue(ex.message!!.contains("PORTHOLE_JWT_SECRET"))
    }
}

