package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Account struct {
	Name    string `json:"name"`
	Address string `json:"address"`
}

type Config struct {
	InfuraAPIKey  string    `json:"infura_api_key"`
	RPCURL        string    `json:"rpc_url"`
	USDCeContract string    `json:"usdc_e_contract"`
	Accounts      []Account `json:"accounts"`
	ListenAddr    string    `json:"listen_addr"`
}

func Default() Config {
	return Config{
		RPCURL:        "https://polygon-mainnet.infura.io/v3/",
		USDCeContract: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
		ListenAddr:    ":8081",
	}
}

func Load(path string) (Config, error) {
	cfg := Default()

	if path == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return cfg, fmt.Errorf("home dir: %w", err)
		}
		path = filepath.Join(home, ".my-token-balance", "config.json")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return cfg, fmt.Errorf("read config %s: %w", path, err)
	}

	var fileCfg Config
	if err := json.Unmarshal(data, &fileCfg); err != nil {
		return cfg, fmt.Errorf("parse config: %w", err)
	}

	if fileCfg.InfuraAPIKey != "" {
		cfg.InfuraAPIKey = fileCfg.InfuraAPIKey
	}
	if fileCfg.RPCURL != "" {
		cfg.RPCURL = fileCfg.RPCURL
	}
	if fileCfg.USDCeContract != "" {
		cfg.USDCeContract = fileCfg.USDCeContract
	}
	if fileCfg.ListenAddr != "" {
		cfg.ListenAddr = fileCfg.ListenAddr
	}
	if len(fileCfg.Accounts) > 0 {
		cfg.Accounts = fileCfg.Accounts
	}

	return cfg, nil
}
