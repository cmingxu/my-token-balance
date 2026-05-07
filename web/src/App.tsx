import { useCallback, useEffect, useState } from 'react'
import { RefreshCcw, Wallet, CircleDollarSign, ServerCrash, ExternalLink, TrendingUp } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type BalanceData = {
  name: string
  address: string
  short: string
  pol: { raw: string; human: string }
  usdc_e: { raw: string; human: string }
  pusd: { raw: string; human: string }
}

type AccountData = {
  name: string
  address: string
  short: string
}

type HistoryEntry = {
  timestamp: string
  pol_balance: number
  usdc_e_balance: number
  pusd_balance: number
  pol_price: number
  total_pusd: number
}

function shortenAddress(addr: string): string {
  if (addr.length < 10) return addr
  return addr.slice(0, 6) + '...' + addr.slice(-4)
}

function formatUSD(value: string | number): string {
  const n = typeof value === 'number' ? value : parseFloat(value)
  if (isNaN(n)) return '$0.00'
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatPOL(value: string): string {
  const n = parseFloat(value)
  if (isNaN(n)) return '0.000000'
  if (n < 0.000001) return '<0.000001'
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 })
}

function formatTime(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

const PUSD_LOGO = (
  <svg viewBox="0 0 100 100" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="50" cy="50" r="48" fill="#10B981" />
    <text x="50" y="68" textAnchor="middle" fill="white" fontSize="40" fontWeight="bold" fontFamily="sans-serif">$</text>
  </svg>
)

function BalancesPage() {
  const [balances, setBalances] = useState<BalanceData[] | null>(null)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchData = useCallback(async (showRefreshSpinner = false) => {
    try {
      if (showRefreshSpinner) setRefreshing(true)
      else setLoading(true)
      setError(null)

      const [balRes, accRes, histRes] = await Promise.all([
        fetch('/api/balances'),
        fetch('/api/accounts'),
        fetch('/api/history'),
      ])

      if (!balRes.ok) throw new Error(`Balances API error: ${balRes.status}`)
      if (!accRes.ok) throw new Error(`Accounts API error: ${accRes.status}`)
      if (!histRes.ok) throw new Error(`History API error: ${histRes.status}`)

      const balData = await balRes.json()
      const accData = await accRes.json()
      const histData = await histRes.json()

      setBalances(balData.balances)
      setAccounts(accData.accounts)
      setHistory(histData.history ?? [])
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
  const totalPUSD = balances?.reduce((sum, b) => sum + parseFloat(b.pusd.human || '0'), 0) ?? 0

  const latestSnapshot = history.length > 0 ? history[history.length - 1] : null

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
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-6">
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Accounts</div>
            <div className="text-2xl font-bold text-gray-900">{accounts.length}</div>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Total POL</div>
            <div className="text-2xl font-bold text-purple-600">{formatPOL(String(totalPOL))} POL</div>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Total USDC.e</div>
            <div className="text-2xl font-bold text-blue-600">{formatUSD(String(totalUSDC))}</div>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Total pUSD</div>
            <div className="text-2xl font-bold text-emerald-600">{formatUSD(String(totalPUSD))}</div>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="text-sm text-muted-foreground mb-1">Portfolio Value</div>
            <div className="text-2xl font-bold text-amber-600">
              {latestSnapshot ? formatUSD(latestSnapshot.total_pusd) : '—'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {latestSnapshot
                ? `POL @ $${latestSnapshot.pol_price.toFixed(4)} · ${formatTime(latestSnapshot.timestamp)}`
                : 'Collecting data...'}
            </div>
          </div>
        </div>

        {/* History Chart */}
        {history.length >= 2 && (
          <div className="glass-card rounded-2xl p-6 mt-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-gray-900">Total pUSD Over Time</h2>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={history} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="pusdGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.08)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTime}
                  stroke="rgba(0,0,0,0.35)"
                  tick={{ fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="rgba(0,0,0,0.35)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatUSD(v)}
                  width={80}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid rgba(0,0,0,0.1)',
                    borderRadius: '12px',
                    color: '#1a1a2e',
                    fontSize: '13px',
                  }}
                  labelFormatter={(label: any) => formatTime(label)}
                  formatter={(value: any) => [formatUSD(Number(value)), 'Total pUSD']}
                />
                <Area
                  type="monotone"
                  dataKey="total_pusd"
                  stroke="#10B981"
                  strokeWidth={2}
                  fill="url(#pusdGradient)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10B981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
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
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load Balances</h2>
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
                    <h2 className="text-lg font-semibold text-gray-900">{bal.name}</h2>
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
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-100">
                    <div className="flex items-center gap-3">
                      {POL_LOGO}
                      <div>
                        <div className="text-sm font-medium text-gray-900">POL</div>
                        <div className="text-xs text-muted-foreground">Native Token</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-gray-900">
                        {formatPOL(bal.pol.human)} POL
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ~{formatUSD(bal.pol.human)}
                      </div>
                    </div>
                  </div>

                  {/* USDC.e */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-100">
                    <div className="flex items-center gap-3">
                      {USDCE_LOGO}
                      <div>
                        <div className="text-sm font-medium text-gray-900">USDC.e</div>
                        <div className="text-xs text-muted-foreground">Bridged USDC</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-gray-900">
                        {formatUSD(bal.usdc_e.human)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {parseFloat(bal.usdc_e.human).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC.e
                      </div>
                    </div>
                  </div>

                  {/* pUSD */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-gray-100">
                    <div className="flex items-center gap-3">
                      {PUSD_LOGO}
                      <div>
                        <div className="text-sm font-medium text-gray-900">pUSD</div>
                        <div className="text-xs text-muted-foreground">Polymarket USD</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-base font-semibold text-gray-900">
                        {formatUSD(bal.pusd.human)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {parseFloat(bal.pusd.human).toLocaleString('en-US', { minimumFractionDigits: 2 })} pUSD
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total */}
                <div className="mt-4 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4 text-primary" />
                    <span className="text-xs text-muted-foreground">Combined Value</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {formatUSD(String(parseFloat(bal.pol.human || '0') + parseFloat(bal.usdc_e.human || '0') + parseFloat(bal.pusd.human || '0')))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-8 pt-4 border-t border-gray-200 text-center">
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
