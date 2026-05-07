package collector

import (
	"context"
	"log"
	"strconv"
	"time"

	"my-token-balance/internal/balance"
	"my-token-balance/internal/config"
	"my-token-balance/internal/store"
)

// POL_USD_PRICE_FEED is the Chainlink MATIC/USD AggregatorV3 on Polygon mainnet.
const POL_USD_PRICE_FEED = "AB594600376Ec9fD91F8e885dADF0CE036862dE0"

// latestAnswer selector: keccak256("latestAnswer()")[:4]
const latestAnswerABI = "50d25bcd"

const maxHistory = 2016 // 7 days at 5-min intervals

type Collector struct {
	balClient *balance.Client
	store     *store.Store
	cfg       config.Config
}

func New(balClient *balance.Client, st *store.Store, cfg config.Config) *Collector {
	return &Collector{
		balClient: balClient,
		store:     st,
		cfg:       cfg,
	}
}

func (c *Collector) Start(ctx context.Context) {
	c.collect()

	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			c.collect()
		}
	}
}

func (c *Collector) collect() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	accounts := make([]balance.AccountInfo, len(c.cfg.Accounts))
	for i, acc := range c.cfg.Accounts {
		accounts[i] = balance.AccountInfo{Name: acc.Name, Address: acc.Address}
	}

	results, err := c.balClient.FetchBalances(ctx, accounts)
	if err != nil {
		log.Printf("collector: fetch balances: %v", err)
		return
	}

	var polTotal, usdceTotal, pusdTotal float64
	for _, r := range results {
		pol, _ := strconv.ParseFloat(r.POL, 64)
		usdce, _ := strconv.ParseFloat(r.USDCe, 64)
		pusd, _ := strconv.ParseFloat(r.PUSD, 64)
		polTotal += pol
		usdceTotal += usdce
		pusdTotal += pusd
	}

	polPrice, err := c.balClient.FetchPOLPrice(ctx, POL_USD_PRICE_FEED, latestAnswerABI)
	if err != nil {
		log.Printf("collector: fetch POL price: %v", err)
		return
	}

	totalPUSD := polTotal*polPrice + usdceTotal + pusdTotal

	c.store.Add(store.Snapshot{
		Timestamp:    time.Now().UTC(),
		POLBalance:   polTotal,
		USDCeBalance: usdceTotal,
		PUSDBalance:  pusdTotal,
		POLPrice:     polPrice,
		TotalPUSD:    totalPUSD,
	})

	log.Printf("collector: snapshot saved — POL=%.2f USDC.e=%.2f pUSD=%.2f POL/USD=%.4f totalPUSD=%.2f",
		polTotal, usdceTotal, pusdTotal, polPrice, totalPUSD)
}
