GO ?= go
BIN ?= my-token-balance
OUTDIR ?= bin
WEB_DIR ?= web
CGO_ENABLED ?= 0
GOOS ?= $(shell $(GO) env GOOS)
GOARCH ?= $(shell $(GO) env GOARCH)

.PHONY: build build-linux build-web dev dev-web dev-server clean deploy deploy-frpc

build: build-web
	@mkdir -p $(OUTDIR)
	CGO_ENABLED=$(CGO_ENABLED) GOOS=$(GOOS) GOARCH=$(GOARCH) $(GO) build -tags embed -o $(OUTDIR)/$(BIN) ./cmd/server

build-linux: GOOS = linux
build-linux: GOARCH = amd64
build-linux: build

build-web:
	cd $(WEB_DIR) && npm install && npm run build

dev:
	$(GO) run ./cmd/server

dev-web:
	cd $(WEB_DIR) && npm run dev

dev-server:
	$(GO) run ./cmd/server

clean:
	rm -rf $(OUTDIR) webui/dist

# Remote deploy target — set SSH_HOST to the remote hostname (default: "dev")
SSH_HOST ?= dev
REMOTE_BIN_DIR ?= /usr/local/bin
REMOTE_ETC_DIR ?= /etc/my-token-balance
REMOTE_VAR_DIR ?= /var/lib/my-token-balance
REMOTE_SERVICE_DIR ?= /etc/systemd/system
REMOTE_FRPC_ETC_DIR ?= /etc/frpc

deploy: build-linux
	@echo "==> Deploying to $(SSH_HOST)..."
	ssh $(SSH_HOST) "sudo mkdir -p $(REMOTE_BIN_DIR) $(REMOTE_ETC_DIR) $(REMOTE_VAR_DIR)"
	rsync -avz $(OUTDIR)/$(BIN) $(SSH_HOST):/tmp/$(BIN)
	ssh $(SSH_HOST) "sudo mv /tmp/$(BIN) $(REMOTE_BIN_DIR)/$(BIN) && sudo chmod 755 $(REMOTE_BIN_DIR)/$(BIN)"
	rsync -avz config.json $(SSH_HOST):/tmp/config.json
	ssh $(SSH_HOST) "sudo mv /tmp/config.json $(REMOTE_ETC_DIR)/config.json && sudo chmod 400 $(REMOTE_ETC_DIR)/config.json"
	rsync -avz my-token-balance.service $(SSH_HOST):/tmp/my-token-balance.service
	ssh $(SSH_HOST) "sudo mv /tmp/my-token-balance.service $(REMOTE_SERVICE_DIR)/my-token-balance.service && sudo systemctl daemon-reload"
	ssh $(SSH_HOST) "sudo systemctl enable --now my-token-balance && sudo systemctl restart my-token-balance"
	@echo "==> Deploy complete. Checking status..."
	ssh $(SSH_HOST) "sudo systemctl status my-token-balance --no-pager"

.PHONY: deploy-frpc
deploy-frpc:
	@echo "==> Deploying frpc to $(SSH_HOST)..."
	ssh $(SSH_HOST) "sudo mkdir -p $(REMOTE_FRPC_ETC_DIR)"
	rsync -avz frpc.toml $(SSH_HOST):/tmp/frpc.toml
	ssh $(SSH_HOST) "sudo mv /tmp/frpc.toml $(REMOTE_FRPC_ETC_DIR)/frpc.toml && sudo chmod 400 $(REMOTE_FRPC_ETC_DIR)/frpc.toml"
	rsync -avz frpc.service $(SSH_HOST):/tmp/frpc.service
	ssh $(SSH_HOST) "sudo mv /tmp/frpc.service $(REMOTE_SERVICE_DIR)/frpc.service && sudo systemctl daemon-reload"
	ssh $(SSH_HOST) "sudo systemctl enable --now frpc && sudo systemctl restart frpc"
	@echo "==> frpc deploy complete. Checking status..."
	ssh $(SSH_HOST) "sudo systemctl status frpc --no-pager"
