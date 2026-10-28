.DEFAULT_GOAL := help

# ── Colours ───────────────────────────────────────────────────────────────────
BOLD  := \033[1m
RESET := \033[0m
GREEN := \033[32m
CYAN  := \033[36m

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT        := $(shell pwd)
SERVER_DIR  := $(ROOT)/server
CLIENT_DIR  := $(ROOT)/client
GRADLE      := $(ROOT)/gradlew
NPM         := npm

# ── GraalVM ───────────────────────────────────────────────────────────────────
# GraalVM distribution to install via SDKMAN when none is found (overridable:
# GRAALVM_SDK_VERSION=21.0.2-graalce make setup-graal).
GRAALVM_SDK_VERSION ?= 25.4.4.1+1-graalce
# Image used by 'make build-native-binary-docker' (brings its own C toolchain, so no
# GraalVM/gcc install is needed on the host).
NATIVE_IMAGE        ?= ghcr.io/graalvm/native-image-community:25
NATIVE_GRADLE_CACHE ?= $(HOME)/.gradle

# ── Docker ────────────────────────────────────────────────────────────────────
IMAGE_NAME  := porthole
IMAGE_TAG   := latest
CONTAINER   := porthole

# ── Environment ───────────────────────────────────────────────────────────────
ENV_FILE := $(ROOT)/.env
ifneq (,$(wildcard $(ENV_FILE)))
  include $(ENV_FILE)
  export $(shell sed 's/=.*//' $(ENV_FILE) | grep -v '^#' | grep -v '^$$')
endif

# Ensure JAVA_HOME points to a Java 25+ JDK for Gradle invocations
ifeq ($(GRAALVM_HOME),)
  SDKMAN_JAVA25 := $(shell ls -d $(HOME)/.sdkman/candidates/java/25* $(HOME)/.sdkman/candidates/java/*-graalce 2>/dev/null | sort -V | tail -1)
  ifneq ($(SDKMAN_JAVA25),)
    export JAVA_HOME := $(SDKMAN_JAVA25)
  endif
else
  export JAVA_HOME := $(GRAALVM_HOME)
endif

# ── Help ──────────────────────────────────────────────────────────────────────
.PHONY: help
help:
	@echo ""
	@echo "  $(BOLD)$(CYAN)Porthole – available targets$(RESET)"
	@echo ""
	@echo "  $(GREEN)Setup$(RESET)"
	@echo "    make setup          Install all dependencies (server + client)"
	@echo "    make setup-server   Resolve Gradle dependencies"
	@echo "    make setup-client   npm install in client"
	@echo "    make setup-graal    Detect/install GraalVM and persist GRAALVM_HOME"
	@echo ""
	@echo "  $(GREEN)Development$(RESET)"
	@echo "    make dev            Start server + client in parallel"
	@echo "    make dev-server     Start Micronaut dev server"
	@echo "    make dev-client     Start Vite dev server"
	@echo ""
	@echo "  $(GREEN)Testing$(RESET)"
	@echo "    make test           Run all tests (server + client)"
	@echo "    make test-server    Run Gradle tests"
	@echo "    make test-client    Run client-side tests"
	@echo ""
	@echo "  $(GREEN)Build$(RESET)"
	@echo "    make build          Build server JAR + client dist"
	@echo "    make build-server   Build server uber-JAR (skip tests)"
	@echo "    make build-client   Vite production build"
	@echo "    make build-native   Native executable via host GraalVM (needs gcc/zlib) -> server/build/native/nativeCompile/porthole-server"
	@echo "    make build-native-in-docker  Native Docker image $(IMAGE_NAME):native (Docker only, no host toolchain)"
	@echo "    make build-native-binary-docker  Native executable in the GraalVM container -> server/build/native/nativeCompile/porthole-server"
	@echo "    make native-metadata  Regenerate native-image reflection config (after DTO changes)"
	@echo ""
	@echo "  $(GREEN)Docker$(RESET)"
	@echo "    make docker-build   Build the Docker image ($(IMAGE_NAME):$(IMAGE_TAG))"
	@echo "    make docker-run-native    Run the native image on port 8080"
	@echo "    make docker-stop-native   Stop & remove the native container"
	@echo "    make docker-run     Run the container on port 8080"
	@echo "    make docker-stop    Stop & remove the running container"
	@echo "    make docker-logs    Tail logs of the running container"
	@echo "    make docker-shell   Open a shell inside the running container"
	@echo ""
	@echo "  $(GREEN)Utilities$(RESET)"
	@echo "    make clean                Remove build artefacts"
	@echo "    make lint-client          ESLint check on client"
	@echo "    make kill-kotlin-daemons  Kill stale Kotlin daemons (fixes 'Failed connecting to daemon')"
	@echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Setup
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: setup
setup: setup-server setup-client
	@echo "$(GREEN)✓ Setup complete$(RESET)"

.PHONY: setup-server
setup-server:
	@echo "$(BOLD)→ Setting up server…$(RESET)"
	cd $(ROOT) && $(GRADLE) :server:dependencies --quiet

.PHONY: setup-client
setup-client:
	@echo "$(BOLD)→ Installing client dependencies…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) install

# Detects an existing GraalVM (GRAALVM_HOME / JAVA_HOME / SDKMAN / PATH), installs
# one via SDKMAN if none is found, and persists GRAALVM_HOME in $(ENV_FILE) so
# every later 'make build-native' picks it up through the .env include above.
.PHONY: setup-graal
setup-graal:
	@echo "$(BOLD)→ Setting up GraalVM for native-image…$(RESET)"
	@home=""; \
	if [ -x "$${GRAALVM_HOME:-/nonexistent}/bin/native-image" ]; then \
	  home="$$GRAALVM_HOME"; \
	elif [ -x "$${JAVA_HOME:-/nonexistent}/bin/native-image" ]; then \
	  home="$$JAVA_HOME"; \
	else \
	  for c in $$(ls -d $(HOME)/.sdkman/candidates/java/*-graalce 2>/dev/null | sort -V); do \
	    [ -x "$$c/bin/native-image" ] && home="$$c"; \
	  done; \
	  if [ -z "$$home" ] && command -v native-image >/dev/null 2>&1; then \
	    home="$$(dirname $$(dirname $$(command -v native-image)))"; \
	  fi; \
	fi; \
	if [ -z "$$home" ]; then \
	  if [ ! -s "$(HOME)/.sdkman/bin/sdkman-init.sh" ]; then \
	    echo "  No GraalVM and no SDKMAN – install one manually, then re-run 'make setup-graal':"; \
	    echo "    https://www.graalvm.org/downloads/ and: export GRAALVM_HOME=/path/to/graalvm"; \
	    exit 1; \
	  fi; \
	  echo "  No GraalVM found – installing $(GRAALVM_SDK_VERSION) via SDKMAN…"; \
	  . "$(HOME)/.sdkman/bin/sdkman-init.sh" && yes n | sdk install java "$(GRAALVM_SDK_VERSION)"; \
	  home="$$(ls -d $(HOME)/.sdkman/candidates/java/*-graalce 2>/dev/null | sort -V | tail -1)"; \
	fi; \
	if [ -z "$$home" ] || [ ! -x "$$home/bin/native-image" ]; then \
	  echo "  setup-graal failed – no usable native-image (tried GRAALVM_HOME, JAVA_HOME, SDKMAN, PATH)."; \
	  exit 1; \
	fi; \
	touch "$(ENV_FILE)"; \
	tmp="$$(mktemp)"; \
	awk -v h="$$home" 'BEGIN{n=0} /^GRAALVM_HOME=/{if(!n){print "GRAALVM_HOME=" h; n=1} next} {print} END{if(!n) print "GRAALVM_HOME=" h}' "$(ENV_FILE)" > "$$tmp" && cat "$$tmp" > "$(ENV_FILE)"; \
	rm -f "$$tmp"; \
	echo "$(GREEN)✓ GRAALVM_HOME=$$home$(RESET) (saved in $(ENV_FILE))"; \
	if ! { command -v gcc >/dev/null 2>&1 || command -v clang >/dev/null 2>&1 || command -v cc >/dev/null 2>&1; } || [ ! -f /usr/include/zlib.h ]; then \
	  echo "  $(BOLD)Note:$(RESET) native-image also needs a C toolchain + zlib headers:"; \
	  echo "    Debian/Ubuntu: sudo apt install build-essential zlib1g-dev"; \
	  echo "    Fedora/RHEL:   sudo dnf install gcc zlib-devel"; \
	  echo "    macOS:         xcode-select --install"; \
	  echo "    Or build the native Docker image instead: make build-native-in-docker"; \
	fi; \
	"$$home/bin/native-image" --version | sed 's/^/    /'

# ─────────────────────────────────────────────────────────────────────────────
# Development
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: dev
dev:
	@echo "$(BOLD)→ Starting server and client (Ctrl+C to stop both)…$(RESET)"
	@trap 'kill 0' INT; \
	  $(MAKE) dev-server & \
	  $(MAKE) dev-client & \
	  wait

.PHONY: dev-server
dev-server:
	@echo "$(BOLD)→ Starting Micronaut dev server…$(RESET)"
	cd $(ROOT) && PORTHOLE_JWT_SECRET=$${PORTHOLE_JWT_SECRET:-porthole-super-secret-key-change-in-production-must-be-256-bits!!} \
	  $(GRADLE) :server:run

.PHONY: dev-client
dev-client:
	@echo "$(BOLD)→ Starting Vite dev server…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) run dev

# ─────────────────────────────────────────────────────────────────────────────
# Testing
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: test
test: test-server test-client
	@echo "$(GREEN)✓ All tests passed$(RESET)"

.PHONY: test-server
test-server:
	@echo "$(BOLD)→ Running server tests…$(RESET)"
	cd $(ROOT) && $(GRADLE) :server:test --rerun

.PHONY: test-client
test-client:
	@echo "$(BOLD)→ Running client tests…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) test

# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: build
build: build-server build-client
	@echo "$(GREEN)✓ Build complete$(RESET)"

.PHONY: build-server
build-server:
	@echo "$(BOLD)→ Building server JAR…$(RESET)"
	cd $(ROOT) && $(GRADLE) :server:shadowJar -x test

.PHONY: build-client
build-client:
	@echo "$(BOLD)→ Building client…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) run build

.PHONY: build-native
build-native:
	@echo "$(BOLD)→ Building GraalVM native image (requires native-image)…$(RESET)"
	@if [ ! -x "$${GRAALVM_HOME:-/nonexistent}/bin/native-image" ] && \
	    [ ! -x "$${JAVA_HOME:-/nonexistent}/bin/native-image" ] && \
	    ! command -v native-image >/dev/null 2>&1; then \
	  echo "  native-image not found – run 'make setup-graal' (detects/installs GraalVM and sets GRAALVM_HOME)."; \
	  exit 1; \
	fi
	cd $(ROOT) && $(GRADLE) :server:nativeCompile -x test

.PHONY: native-metadata
native-metadata:
	@echo "$(BOLD)→ Regenerating native-image reflection config…$(RESET)"
	cd $(ROOT) && $(GRADLE) :server:classes
	python3 $(ROOT)/scripts/generate-native-reflect-config.py

# Builds the native Docker image ($(IMAGE_NAME):native): multi-stage build (client +
# GraalVM binary + distroless runtime), so it needs Docker only – no host GraalVM or
# C toolchain. Run it with 'make docker-run-native'.
.PHONY: build-native-in-docker
build-native-in-docker:
	@echo "$(BOLD)→ Building native Docker image $(IMAGE_NAME):native…$(RESET)"
	docker build -f $(ROOT)/Dockerfile.native -t $(IMAGE_NAME):native $(ROOT)
	@echo "$(GREEN)✓ Image built: $(IMAGE_NAME):native$(RESET)"

# Raw native executable built inside the GraalVM container: same output as 'build-native'
# (server/build/native/nativeCompile/porthole-server) but works on hosts without GraalVM or a C toolchain.
.PHONY: build-native-binary-docker
build-native-binary-docker:
	@echo "$(BOLD)→ Building native executable in $(NATIVE_IMAGE)…$(RESET)"
	@mkdir -p "$(NATIVE_GRADLE_CACHE)"
	docker run --rm --entrypoint /bin/bash \
	  --user "$$(id -u):$$(id -g)" \
	  -e HOME=/tmp/home -e LANG=C.UTF-8 \
	  -v "$(ROOT)":/work -w /work \
	  -v "$(NATIVE_GRADLE_CACHE)":/tmp/home/.gradle \
	  $(NATIVE_IMAGE) \
	  -c './gradlew :server:nativeCompile -x test --no-daemon'
	@echo "$(GREEN)✓ Native executable: server/build/native/nativeCompile/porthole-server$(RESET)"

# ─────────────────────────────────────────────────────────────────────────────
# Utilities
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: lint-client
lint-client:
	@echo "$(BOLD)→ Linting client…$(RESET)"
	cd $(CLIENT_DIR) && $(NPM) run lint

.PHONY: clean
clean:
	@echo "$(BOLD)→ Cleaning build artefacts…$(RESET)"
	cd $(ROOT) && $(GRADLE) clean
	rm -rf $(CLIENT_DIR)/dist $(CLIENT_DIR)/node_modules/.vite
	@echo "$(GREEN)✓ Clean complete$(RESET)"

.PHONY: kill-kotlin-daemons
kill-kotlin-daemons:
	@echo "$(BOLD)→ Killing stale Kotlin compiler daemons (not IntelliJ)…$(RESET)"
	@pkill -f "kotlin-build-tools-impl.*KotlinCompileDaemon" 2>/dev/null || true
	@rm -f $(HOME)/.local/share/kotlin/daemon/*.run
	@echo "$(GREEN)✓ Kotlin daemons cleared$(RESET)"

# ─────────────────────────────────────────────────────────────────────────────
# Docker
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: docker-build
docker-build:
	@echo "$(BOLD)→ Building Docker image $(IMAGE_NAME):$(IMAGE_TAG)…$(RESET)"
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) $(ROOT)
	@echo "$(GREEN)✓ Image built: $(IMAGE_NAME):$(IMAGE_TAG)$(RESET)"

.PHONY: docker-run
docker-run:
	@echo "$(BOLD)→ Starting container $(CONTAINER) on port 8080…$(RESET)"
	docker run -d --name $(CONTAINER) -p 8080:8080 \
	  $(if $(wildcard $(ENV_FILE)),--env-file $(ENV_FILE),) \
	  -e PORTHOLE_ALLOWED_ORIGINS=http://localhost:8080 \
	  $(IMAGE_NAME):$(IMAGE_TAG)
	@echo "$(GREEN)✓ Container started – http://localhost:8080$(RESET)"

.PHONY: docker-stop
docker-stop:
	@echo "$(BOLD)→ Stopping container $(CONTAINER)…$(RESET)"
	docker stop $(CONTAINER) 2>/dev/null || true
	docker rm   $(CONTAINER) 2>/dev/null || true
	@echo "$(GREEN)✓ Container stopped & removed$(RESET)"

.PHONY: docker-logs
docker-logs:
	docker logs -f $(CONTAINER)

.PHONY: docker-shell
docker-shell:
	docker exec -it $(CONTAINER) /bin/sh

.PHONY: docker-run-native
docker-run-native:
	@echo "$(BOLD)→ Starting native container $(CONTAINER)-native on port 8080…$(RESET)"
	docker rm -f $(CONTAINER)-native >/dev/null 2>&1 || true
	docker run -d --name $(CONTAINER)-native -p 8080:8080 \
	  $(if $(wildcard $(ENV_FILE)),--env-file $(ENV_FILE),) \
	  -e PORTHOLE_STORAGE_PATH=/data \
	  -e PORTHOLE_ALLOWED_ORIGINS=http://localhost:8080 \
	  -v $(CONTAINER)-native-data:/data \
	  $(IMAGE_NAME):native
	@echo "$(GREEN)✓ Native container started – http://localhost:8080$(RESET)"

.PHONY: docker-stop-native
docker-stop-native:
	@echo "$(BOLD)→ Stopping native container $(CONTAINER)-native…$(RESET)"
	docker stop $(CONTAINER)-native 2>/dev/null || true
	docker rm   $(CONTAINER)-native 2>/dev/null || true
	@echo "$(GREEN)✓ Native container stopped & removed$(RESET)"
