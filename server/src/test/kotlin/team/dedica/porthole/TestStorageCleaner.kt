package team.dedica.porthole

import org.springframework.context.ApplicationContextInitializer
import org.springframework.context.ConfigurableApplicationContext
import org.springframework.test.context.support.TestPropertySourceUtils
import java.nio.file.Files

/**
 * Redirects JSON storage to a fresh temporary directory for each test context,
 * so tests never read stale data from a previous run.
 */
class TestStorageCleaner : ApplicationContextInitializer<ConfigurableApplicationContext> {
    override fun initialize(ctx: ConfigurableApplicationContext) {
        val tempDir = Files.createTempDirectory("landmarks-test-storage").toAbsolutePath().toString()
        TestPropertySourceUtils.addInlinedPropertiesToEnvironment(
            ctx, "landmarks.storage.path=$tempDir"
        )
    }
}



