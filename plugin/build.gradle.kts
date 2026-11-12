plugins {
    java
}

group = "id.cipismp"
version = "1.1.0"

// Keep the existing 1.21.4 build while providing an explicit 26.1.2 build.
// Newer Paper APIs require Java 25; selecting the target must not silently
// change the requirements of existing deployments.
val paperTarget = providers.gradleProperty("paperTarget").orElse("1.21.4").get()
val javaTarget = when (paperTarget) {
    "1.21.4" -> 21
    "26.1.2" -> 25
    else -> error("paperTarget must be 1.21.4 or 26.1.2")
}
val paperApiVersion = when (paperTarget) {
    "1.21.4" -> "1.21.4-R0.1-SNAPSHOT"
    "26.1.2" -> "26.1.2.build.74-stable"
    else -> error("Unsupported paperTarget")
}

java {
    toolchain.languageVersion.set(JavaLanguageVersion.of(javaTarget))
}

repositories {
    mavenCentral()
    maven("https://repo.papermc.io/repository/maven-public/")
    maven("https://oss.sonatype.org/content/repositories/snapshots/")
}

dependencies {
    compileOnly("io.papermc.paper:paper-api:$paperApiVersion")
    compileOnly("net.luckperms:api:5.4")
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.2")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher:1.10.2")
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
    options.release.set(javaTarget)
}

tasks.processResources {
    filteringCharset = "UTF-8"
    val props = mapOf("version" to project.version.toString())
    inputs.properties(props)
    filesMatching("plugin.yml") {
        expand(props)
    }
}

tasks.test {
    useJUnitPlatform()
}
