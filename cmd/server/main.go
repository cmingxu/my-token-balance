package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"my-token-balance/internal/balance"
	"my-token-balance/internal/collector"
	"my-token-balance/internal/config"
	"my-token-balance/internal/handler"
	"my-token-balance/internal/store"
	"my-token-balance/webui"
)

func main() {
	configPath := flag.String("config", "", "path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	if cfg.InfuraAPIKey == "" {
		log.Fatal("infura_api_key is required in config")
	}
	if len(cfg.Accounts) == 0 {
		log.Fatal("at least one account is required in config")
	}

	rpcURL := cfg.RPCURL + cfg.InfuraAPIKey
	balClient := balance.New(rpcURL, cfg.USDCeContract, cfg.PUSDContract)

	st := store.New(2016) // 7 days at 5-min intervals

	col := collector.New(balClient, st, cfg)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go col.Start(ctx)

	h := handler.New(balClient, cfg, st)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Recovery())

	h.Register(r)
	webui.Register(r)

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}

	errCh := make(chan error, 1)
	go func() { errCh <- srv.ListenAndServe() }()

	log.Printf("server listening on %s", cfg.ListenAddr)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	select {
	case sig := <-sigCh:
		log.Printf("signal: %s", sig)
	case err := <-errCh:
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("server error: %v", err)
		}
	}

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
}
