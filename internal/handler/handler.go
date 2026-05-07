package handler

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"my-token-balance/internal/balance"
	"my-token-balance/internal/config"
	"my-token-balance/internal/store"
)

type Handler struct {
	balClient *balance.Client
	cfg       config.Config
	store     *store.Store
}

func New(balClient *balance.Client, cfg config.Config, st *store.Store) *Handler {
	return &Handler{
		balClient: balClient,
		cfg:       cfg,
		store:     st,
	}
}

func (h *Handler) Register(r *gin.Engine) {
	r.GET("/api/health", h.health)
	r.GET("/api/balances", h.getBalances)
	r.GET("/api/accounts", h.getAccounts)
	r.GET("/api/history", h.getHistory)
}

func (h *Handler) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"ok":   true,
		"time": time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (h *Handler) getAccounts(c *gin.Context) {
	accounts := make([]gin.H, len(h.cfg.Accounts))
	for i, acc := range h.cfg.Accounts {
		accounts[i] = gin.H{
			"name":    acc.Name,
			"address": acc.Address,
			"short":   balance.ShortAddress(acc.Address),
		}
	}
	c.JSON(http.StatusOK, gin.H{"accounts": accounts})
}

func (h *Handler) getBalances(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	accounts := make([]balance.AccountInfo, len(h.cfg.Accounts))
	for i, acc := range h.cfg.Accounts {
		accounts[i] = balance.AccountInfo{Name: acc.Name, Address: acc.Address}
	}

	results, err := h.balClient.FetchBalances(ctx, accounts)
	if err != nil {
		log.Printf("fetch balances: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type tokenInfo struct {
		Raw   string `json:"raw"`
		Human string `json:"human"`
	}

	type accountBal struct {
		Name    string    `json:"name"`
		Address string    `json:"address"`
		Short   string    `json:"short"`
		POL     tokenInfo `json:"pol"`
		USDCe   tokenInfo `json:"usdc_e"`
		PUSD    tokenInfo `json:"pusd"`
	}

	resp := make([]accountBal, len(results))
	for i, r := range results {
		resp[i] = accountBal{
			Name:    r.Name,
			Address: r.Address,
			Short:   balance.ShortAddress(r.Address),
			POL: tokenInfo{
				Raw:   r.POLWei,
				Human: r.POL,
			},
			USDCe: tokenInfo{
				Raw:   r.USDCeWe,
				Human: r.USDCe,
			},
			PUSD: tokenInfo{
				Raw:   r.PUSDWei,
				Human: r.PUSD,
			},
		}
	}

	c.JSON(http.StatusOK, gin.H{"balances": resp})
}

func (h *Handler) getHistory(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"history": h.store.GetAll()})
}
