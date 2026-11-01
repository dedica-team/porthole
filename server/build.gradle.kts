plugins {
    id("org.jetbrains.kotlin.jvm") version "2.4.21"
    id("org.jetbrains.kotlin.kapt") version "2.4.21"
    id("org.jetbrains.kotlin.plugin.allopen") version "2.4.21"
    id("io.micronaut.application") version "5.0.2"
    id("com.gradleup.shadow") version "9.4.1"
    id("org.graalvm.buildtools.native") version "1.1.18"
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(25))
    }
}

kotlin {
    jvmToolchain(25)
    compilerOptions {
        javaParameters.set(true)
    }
}

allOpen {
    annotation("io.micronaut.context.annotation.Singleton")
    annotation("io.micronaut.context.annotation.Factory")
    annotation("io.micronaut.aop.Around")
    annotation("io.micronaut.http.annotation.Controller")
    annotation("io.micronaut.context.annotation.ConfigurationProperties")
}

micronaut {
    version = "5.2.4"
    runtime("netty")
    testRuntime("junit5")
    processing {
        incremental = true
        annotations("team.dedica.porthole.*")
    }
}

application {
    mainClass.set("team.dedica.porthole.PortholeApplicationKt")
}

dependencies {
    kapt("io.micronaut:micronaut-inject-java")
    kapt("io.micronaut.validation:micronaut-validation-processor")
    kapt("io.micronaut.security:micronaut-security-processor")
    kapt("io.micronaut:micronaut-graal")

    implementation("io.micronaut:micronaut-http-server-netty")
    implementation("io.micronaut:micronaut-http-client")
    implementation("io.micronaut:micronaut-runtime")
    implementation("io.micronaut:micronaut-management")
    implementation("io.micronaut:micronaut-websocket")
    implementation("io.micronaut.reactor:micronaut-reactor")
    implementation("io.micronaut:micronaut-jackson-databind")
    implementation("tools.jackson.module:jackson-module-kotlin")
    implementation("io.micronaut.validation:micronaut-validation")
    implementation("jakarta.validation:jakarta.validation-api")
    implementation("io.micronaut.security:micronaut-security")
    implementation("io.micronaut.security:micronaut-security-oauth2")
    implementation("io.micronaut.security:micronaut-security-jwt")
    implementation("io.micronaut.kotlin:micronaut-kotlin-runtime")
    implementation("org.jetbrains.kotlin:kotlin-stdlib")
    implementation("org.jetbrains.kotlin:kotlin-reflect")
    implementation("com.yubico:webauthn-server-core:2.10.1")
    implementation("io.jsonwebtoken:jjwt-api")
    runtimeOnly("io.jsonwebtoken:jjwt-impl")
    runtimeOnly("io.jsonwebtoken:jjwt-jackson")
    implementation("org.yaml:snakeyaml")
    runtimeOnly("ch.qos.logback:logback-classic")

    testImplementation("io.micronaut.test:micronaut-test-junit5")
    testImplementation("org.junit.jupiter:junit-jupiter-api")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine")
    testImplementation("org.mockito:mockito-core")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.4.0")
    testImplementation("com.github.dasniko:testcontainers-keycloak:3.9.1")
    testImplementation("org.testcontainers:testcontainers-junit-jupiter:2.0.5")
    testImplementation(kotlin("test"))
}

tasks.withType<Test>().configureEach {
    useJUnitPlatform()
    environment("DOCKER_API_VERSION", "1.44")
    systemProperty("api.version", "1.44")
    systemProperty("docker.api.version", "1.44")
    testLogging {
        events("passed", "skipped", "failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}

graalvmNative {
    binaries {
        named("main") {
            imageName.set("porthole-server")
            mainClass.set("team.dedica.porthole.PortholeApplicationKt")
            buildArgs.addAll(
                "--no-fallback",
                "-H:+UnlockExperimentalVMOptions",
                "-H:+StaticExecutableWithDynamicLibC",
            )
        }
    }
}
