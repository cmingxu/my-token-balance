package balance

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"strings"
)

type RPCRequest struct {
	JSONRPC string        `json:"jsonrpc"`
	Method  string        `json:"method"`
	Params  []interface{} `json:"params"`
	ID      int           `json:"id"`
}

type RPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	Result  json.RawMessage `json:"result"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
	ID int `json:"id"`
}

type AccountInfo struct {
	Name    string
	Address string
}

type BalanceResult struct {
	Address string  `json:"address"`
	Name    string  `json:"name"`
	POL     string  `json:"pol"`
	USDCe   string  `json:"usdc_e"`
	PUSD    string  `json:"pusd"`
	POLWei  string  `json:"pol_wei"`
	USDCeWe string  `json:"usdc_e_wei"`
	PUSDWei string  `json:"pusd_wei"`
}

type Client struct {
	rpcURL       string
	usdcContract string
	pusdContract string
	httpClient   *http.Client
}

func New(rpcURL, usdcContract, pusdContract string) *Client {
	return &Client{
		rpcURL:       rpcURL,
		usdcContract: strings.TrimPrefix(usdcContract, "0x"),
		pusdContract: strings.TrimPrefix(pusdContract, "0x"),
		httpClient:   &http.Client{},
	}
}

func (c *Client) callRPC(ctx context.Context, req RPCRequest) (*RPCResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.rpcURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("post: %w", err)
	}
	defer resp.Body.Close()

	var rpcResp RPCResponse
	if err := json.NewDecoder(resp.Body).Decode(&rpcResp); err != nil {
		return nil, fmt.Errorf("decode: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("rpc error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	return &rpcResp, nil
}

// balanceOfABI is the ERC-20 balanceOf function selector: keccak256("balanceOf(address)")[:4]
const balanceOfABI = "70a08231"

func (c *Client) FetchBalances(ctx context.Context, accounts []AccountInfo) ([]BalanceResult, error) {
	results := make([]BalanceResult, len(accounts))

	for i, acc := range accounts {
		addr := strings.TrimPrefix(acc.Address, "0x")

		// 1. Get POL balance (native token)
		polResp, err := c.callRPC(ctx, RPCRequest{
			JSONRPC: "2.0",
			Method:  "eth_getBalance",
			Params:  []interface{}{"0x" + addr, "latest"},
			ID:      1,
		})
		if err != nil {
			return nil, fmt.Errorf("POL balance for %s: %w", acc.Address, err)
		}

		var polWeiHex string
		if err := json.Unmarshal(polResp.Result, &polWeiHex); err != nil {
			return nil, fmt.Errorf("parse POL result: %w", err)
		}

		// balanceOf(address) encoded call
		paddedAddr := "000000000000000000000000" + addr

		// 2. Get USDC.e balance (ERC-20)
		usdcData := "0x" + balanceOfABI + paddedAddr

		usdcResp, err := c.callRPC(ctx, RPCRequest{
			JSONRPC: "2.0",
			Method:  "eth_call",
			Params:  []interface{}{map[string]interface{}{"to": "0x" + c.usdcContract, "data": usdcData}, "latest"},
			ID:      2,
		})
		if err != nil {
			return nil, fmt.Errorf("USDC.e balance for %s: %w", acc.Address, err)
		}

		var usdcWeiHex string
		if err := json.Unmarshal(usdcResp.Result, &usdcWeiHex); err != nil {
			return nil, fmt.Errorf("parse USDC.e result: %w", err)
		}

		// 3. Get pUSD balance (ERC-20)
		pusdData := "0x" + balanceOfABI + paddedAddr

		pusdResp, err := c.callRPC(ctx, RPCRequest{
			JSONRPC: "2.0",
			Method:  "eth_call",
			Params:  []interface{}{map[string]interface{}{"to": "0x" + c.pusdContract, "data": pusdData}, "latest"},
			ID:      3,
		})
		if err != nil {
			return nil, fmt.Errorf("pUSD balance for %s: %w", acc.Address, err)
		}

		var pusdWeiHex string
		if err := json.Unmarshal(pusdResp.Result, &pusdWeiHex); err != nil {
			return nil, fmt.Errorf("parse pUSD result: %w", err)
		}

		results[i] = BalanceResult{
			Address:  acc.Address,
			Name:     acc.Name,
			POLWei:   polWeiHex,
			USDCeWe:  usdcWeiHex,
			PUSDWei:  pusdWeiHex,
			POL:      weiToEther(polWeiHex),
			USDCe:    weiToUSDC(usdcWeiHex),
			PUSD:     weiToUSDC(pusdWeiHex),
		}
	}

	return results, nil
}

func weiToEther(hexStr string) string {
	hexStr = strings.TrimPrefix(hexStr, "0x")
	if hexStr == "" {
		return "0"
	}
	b, ok := new(big.Int).SetString(hexStr, 16)
	if !ok {
		return "0"
	}
	// Divide by 10^18
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(18), nil)
	result := new(big.Rat).SetFrac(b, divisor)
	return result.FloatString(6)
}

func weiToUSDC(hexStr string) string {
	hexStr = strings.TrimPrefix(hexStr, "0x")
	if hexStr == "" || hexStr == "0" {
		return "0"
	}
	b, ok := new(big.Int).SetString(hexStr, 16)
	if !ok {
		return "0"
	}
	// 6 decimals (used by USDC.e and pUSD)
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(6), nil)
	result := new(big.Rat).SetFrac(b, divisor)
	return result.FloatString(2)
}

func (c *Client) FetchPOLPrice(ctx context.Context, priceFeed, abiSelector string) (float64, error) {
	data := "0x" + abiSelector

	resp, err := c.callRPC(ctx, RPCRequest{
		JSONRPC: "2.0",
		Method:  "eth_call",
		Params:  []interface{}{map[string]interface{}{"to": "0x" + priceFeed, "data": data}, "latest"},
		ID:      4,
	})
	if err != nil {
		return 0, fmt.Errorf("POL price feed call: %w", err)
	}

	var priceHex string
	if err := json.Unmarshal(resp.Result, &priceHex); err != nil {
		return 0, fmt.Errorf("parse POL price: %w", err)
	}

	return weiToPrice(priceHex), nil
}

// weiToPrice converts Chainlink price feed answer (int256, 8 decimals) to float64.
func weiToPrice(hexStr string) float64 {
	hexStr = strings.TrimPrefix(hexStr, "0x")
	if hexStr == "" || hexStr == "0" {
		return 0
	}
	b, ok := new(big.Int).SetString(hexStr, 16)
	if !ok {
		return 0
	}
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(8), nil)
	result := new(big.Rat).SetFrac(b, divisor)
	f, _ := result.Float64()
	return f
}

// ShortAddress shortens an address for display
func ShortAddress(addr string) string {
	if len(addr) < 10 {
		return addr
	}
	return addr[:6] + "..." + addr[len(addr)-4:]
}
