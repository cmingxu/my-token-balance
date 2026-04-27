import { useCallback, useEffect, useState } from 'react'
import { RefreshCcw, Wallet, CircleDollarSign, ServerCrash, ExternalLink } from 'lucide-react'

type BalanceData = {
  name: string
  address: string
  short: string
  pol: { raw: string; human: string }
  usdc_e: { raw: string; human: string }
}

type AccountData = {
  name: string
  address: string
  short: string
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function formatUSD(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return '$0.00'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPOL(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return '0.000000'
  if (n < 0.000001) return '<0.000001'
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

const POL_LOGO = (
  <svg viewBox="0 0 100 100" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#8247E5" />
    <path d="M50 8L73 25V43L50 60L27 43V25L50 8Z" fill="white" fillOpacity="0.9" />
    <path d="M27 57L50 74L73 57V75L50 92L27 75V57Z" fill="white" fillOpacity="0.6" />
  </svg>
)

const USDCE_LOGO = (
  <svg viewBox="0 0 100 100" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#2775CA" />
    <path d="M50 8C67.5 8 82 22.5 82 40C82 57.5 67.5 72 50 72C32.5 72 18 57.5 18 40C18 22.5 32.5 8 50 8Z" fill="white" fillOpacity="0.9" />
    <circle cx="50" cy="40" r="12" fill="#2775CA" />
    <rect x="47" y="35" width="6" height="10" rx="3" fill="white" />
  </svg>
)

function BalancesPage() {
  const [balances, setBalances] = useState<BalanceData[] | null>(null)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (showRefreshSpinner = false) => {
    try {
      if (showRefreshSpinner) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const [balRes, accRes] = await Promise.all([
        fetch('/api/balances'),
        fetch('/api/accounts'),
      ])

      if (!balRes.ok) throw new Error(`Balances API error: ${balRes.status}`)
      if (!accRes.ok) throw new Error(`Accounts API error: ${accRes.status}`)

      const balData = await balRes.json()
      const accData = await accRes.json()

      setBalances(balData.balances)
      setAccounts(accData.accounts)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const totalPOL = balances?.reduce((sum, b) => sum + parseFloat(b.pol.human || '0'), 0) ?? 0
  const totalUSDC = balances?.reduce((sum, b) => sum + parseFloat(b.usdc_e.human || '0'), 0) ?? 0

  return (
    <div className="min-h-screen p-4 md:p-8">
      {/* Header */}
      <header className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-xl bg-primary/10">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white">
                Token Balance Dashboard
              </h1>
            </div>
            <p className="text-muted-foreground ml-11">
              Polygon Network — Real-time Token Balances
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Accounts</div>
            <div className="text-2xl font-bold text-white">{accounts.length}</div>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Total POL</div>
            <div className="text-2xl font-bold text-purple-400">{formatPOL(String(totalPOL))} POL</div>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Total USDC.e</div>
            <div className="text-2xl font-bold text-blue-400">{formatUSD(String(totalUSDC))}</div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground">Fetching balances...</p>
          </div>
        )}

        {error && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <ServerCrash className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-white mb-2">Failed to Load Balances</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => fetchData(true)}
              className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-all"
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && balances && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {balances.map((bal) => (
              <div key={bal.address} className="glass-card rounded-2xl p-6 gradient-border">
                {/* Account Header */}
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{bal.name}</h2>
                    <a
                      href={`https://polygonscan.com/address/${bal.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mt-0.5"
                    >
                      {shortenAddress(bal.address)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                </div>

                {/* Token Balances */}
                <div className="space-y-3">
                  {/* POL */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/20">
                    <div className="flex items-center gap-3">
                      {POL_LOGO}
                      <div>
                        <div className="text-sm font-medium text-white">POL</div>
                        <div className="text-xs text-muted-foreground">Native Token</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-white">
                        {formatPOL(bal.pol.human)} POL
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ~{formatUSD(bal.pol.human)}
                      </div>
                    </div>
                  </div>

                  {/* USDC.e */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-black/20">
                    <div className="flex items-center gap-3">
                      {USDCE_LOGO}
                      <div>
                        <div className="text-sm font-medium text-white">USDC.e</div>
                        <div className="text-xs text-muted-foreground">Bridged USDC</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-white">
                        {formatUSD(bal.usdc_e.human)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {parseFloat(bal.usdc_e.human).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC.e
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Combined Value</span>
                  </div>
                  <span className="text-sm font-medium text-white">
                    {formatUSD(bal.pol.human)} + {formatUSD(bal.usdc_e.human)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-8 pt-4 border-t border-white/5 text-center">
        <p className="text-xs text-muted-foreground">
          Data via Infura · Polygon Mainnet · Auto-refresh not available
        </p>
      </footer>
    </div>
  )
}

export default function App() {
  return <BalancesPage />
}
