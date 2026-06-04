import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import '../styles/stock.css'

interface VentaRow {
  fecha_comprobante: string
  id_sucursal: number
  ds_sucursal: string
  id_deposito: number
  ds_deposito: string
  id_vendedor: number
  ds_vendedor: string
  id_articulo: number
  ds_articulo: string
  id_cliente: number
  nombre_cliente: string
  cantidades_total: number
  subtotal_neto: number
  subtotal_final: number
  iva21: number
  iva105: number
  anulado: string
}

interface SucursalStats {
  id_sucursal: number
  ds_sucursal: string
  ventas: number
  unidades: number
  neto: number
  total: number
  tickets: number
  ticketPromedio: number
  topArticulo: string
}

interface VendedorStats {
  ds_vendedor: string
  ventas: number
  total: number
  tickets: number
}

function fmt(n: number, decimals = 0) {
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function fmtMoney(n: number) {
  return '$\u00A0' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const PERIODOS = [
  { label: 'HOY', days: 0 },
  { label: '7 DÍAS', days: 7 },
  { label: '15 DÍAS', days: 15 },
  { label: '30 DÍAS', days: 30 },
]

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export function VentasPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<VentaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState(7)
  const [sucursal, setSucursal] = useState<string>('todas')
  const [tab, setTab] = useState<'sucursal' | 'vendedor' | 'articulo'>('sucursal')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const desde = periodo === 0 ? daysAgo(0) : daysAgo(periodo)
      let q = supabase
        .from('chess_ventas')
        .select('fecha_comprobante,id_sucursal,ds_sucursal,id_deposito,ds_deposito,id_vendedor,ds_vendedor,id_articulo,ds_articulo,id_cliente,nombre_cliente,cantidades_total,subtotal_neto,subtotal_final,iva21,iva105,anulado')
        .eq('anulado', 'NO')
        .gte('fecha_comprobante', desde)
        .not('id_articulo', 'is', null)
      const { data: rows, error: err } = await q
      if (err) { setError(err.message); setLoading(false); return }
      setData(rows as VentaRow[])
      setLoading(false)
    }
    load()
  }, [periodo])

  const sucursales = useMemo(() => {
    const map = new Map<number, string>()
    data.forEach(r => map.set(r.id_sucursal, r.ds_sucursal))
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [data])

  const base = useMemo(() =>
    sucursal === 'todas' ? data : data.filter(r => r.id_sucursal === Number(sucursal))
  , [data, sucursal])

  // KPIs globales
  const kpis = useMemo(() => {
    const total = base.reduce((s, r) => s + (r.subtotal_final ?? 0), 0)
    const neto = base.reduce((s, r) => s + (r.subtotal_neto ?? 0), 0)
    const unidades = base.reduce((s, r) => s + (r.cantidades_total ?? 0), 0)
    const comprobantes = new Set(base.map(r => `${r.id_sucursal}-${r.fecha_comprobante}`)).size
    const clientes = new Set(base.map(r => r.id_cliente)).size
    const iva = total - neto
    return { total, neto, unidades, comprobantes, clientes, iva }
  }, [base])

  // Stats por sucursal
  const porSucursal: SucursalStats[] = useMemo(() => {
    const map = new Map<number, SucursalStats & { artMap: Map<string, number> }>()
    data.forEach(r => {
      if (!map.has(r.id_sucursal)) {
        map.set(r.id_sucursal, {
          id_sucursal: r.id_sucursal, ds_sucursal: r.ds_sucursal,
          ventas: 0, unidades: 0, neto: 0, total: 0, tickets: 0,
          ticketPromedio: 0, topArticulo: '', artMap: new Map()
        })
      }
      const s = map.get(r.id_sucursal)!
      s.ventas++
      s.unidades += r.cantidades_total ?? 0
      s.neto += r.subtotal_neto ?? 0
      s.total += r.subtotal_final ?? 0
      s.artMap.set(r.ds_articulo, (s.artMap.get(r.ds_articulo) ?? 0) + (r.cantidades_total ?? 0))
    })
    return Array.from(map.values()).map(s => {
      const top = Array.from(s.artMap.entries()).sort((a, b) => b[1] - a[1])[0]
      return { ...s, tickets: s.ventas, ticketPromedio: s.total / Math.max(s.ventas, 1), topArticulo: top?.[0] ?? '—' }
    }).sort((a, b) => b.total - a.total)
  }, [data])

  // Stats por vendedor (filtrado por sucursal)
  const porVendedor: VendedorStats[] = useMemo(() => {
    const map = new Map<string, VendedorStats>()
    base.forEach(r => {
      const k = r.ds_vendedor || 'Sin asignar'
      if (!map.has(k)) map.set(k, { ds_vendedor: k, ventas: 0, total: 0, tickets: 0 })
      const v = map.get(k)!
      v.ventas++
      v.total += r.subtotal_final ?? 0
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 15)
  }, [base])

  // Top artículos
  const topArticulos = useMemo(() => {
    const map = new Map<number, { id: number; nombre: string; unidades: number; total: number }>()
    base.forEach(r => {
      if (!map.has(r.id_articulo)) map.set(r.id_articulo, { id: r.id_articulo, nombre: r.ds_articulo, unidades: 0, total: 0 })
      const a = map.get(r.id_articulo)!
      a.unidades += r.cantidades_total ?? 0
      a.total += r.subtotal_final ?? 0
    })
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 20)
  }, [base])

  const maxTotal = useMemo(() => Math.max(...porSucursal.map(s => s.total), 1), [porSucursal])
  const maxVend = useMemo(() => Math.max(...porVendedor.map(v => v.total), 1), [porVendedor])
  const maxArt = useMemo(() => Math.max(...topArticulos.map(a => a.unidades), 1), [topArticulos])

  if (loading) return (
    <div className="page-loading">
      <div className="loading-spinner" />
      <span>Cargando ventas...</span>
    </div>
  )
  if (error) return <div className="page-loading"><span className="error-msg">Error: {error}</span></div>

  return (
    <div className="stock-root">
      <div className="dash-bg"><div className="grid-overlay" /></div>

      <header className="dash-header">
        <div className="header-left">
          <div className="dash-logo">
            <span className="logo-bracket">[</span>
            <span className="logo-text">APP</span>
            <span className="logo-bracket">]</span>
          </div>
          <nav className="header-nav">
            <Link to="/dashboard" className="nav-link">INICIO</Link>
            <Link to="/stock" className="nav-link">STOCK</Link>
            <Link to="/ventas" className="nav-link active">VENTAS</Link>
          </nav>
        </div>
        <button className="logout-btn" onClick={() => { logout(); navigate('/login') }}>
          SALIR <span>→</span>
        </button>
      </header>

      <main className="stock-main">

        <div className="page-title-block">
          <span className="page-tag">ANÁLISIS DE VENTAS</span>
          <h1 className="page-title">Ventas por <em>sucursal</em></h1>
          <p className="page-sub">Comprobantes facturados · excluye anulados</p>
        </div>

        {/* Filtros */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">PERÍODO</label>
            <div className="period-tabs">
              {PERIODOS.map(p => (
                <button
                  key={p.days}
                  className={`period-tab ${periodo === p.days ? 'active' : ''}`}
                  onClick={() => setPeriodo(p.days)}
                >{p.label}</button>
              ))}
            </div>
          </div>
          <div className="filter-group">
            <label className="filter-label">SUCURSAL</label>
            <select className="filter-select" value={sucursal} onChange={e => setSucursal(e.target.value)}>
              <option value="todas">Todas</option>
              {sucursales.map(([id, name]) => (
                <option key={id} value={id}>{name || `Sucursal ${id}`}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-grid">
          <div className="kpi-card accent">
            <span className="kpi-label">TOTAL FACTURADO</span>
            <span className="kpi-value">{fmtMoney(kpis.total)}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">NETO (SIN IVA)</span>
            <span className="kpi-value">{fmtMoney(kpis.neto)}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">IVA TOTAL</span>
            <span className="kpi-value">{fmtMoney(kpis.iva)}</span>
          </div>
          <div className="kpi-card accent2">
            <span className="kpi-label">UNIDADES VENDIDAS</span>
            <span className="kpi-value">{fmt(kpis.unidades, 0)}</span>
          </div>
          <div className="kpi-card">
            <span className="kpi-label">CLIENTES ÚNICOS</span>
            <span className="kpi-value">{fmt(kpis.clientes)}</span>
          </div>
        </div>

        {/* Tabs de análisis */}
        <div className="analysis-tabs">
          {(['sucursal', 'vendedor', 'articulo'] as const).map(t => (
            <button key={t} className={`analysis-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'sucursal' ? 'POR SUCURSAL' : t === 'vendedor' ? 'POR VENDEDOR' : 'TOP ARTÍCULOS'}
            </button>
          ))}
        </div>

        {/* Panel por sucursal */}
        {tab === 'sucursal' && (
          <div className="analysis-panel">
            {porSucursal.map(s => (
              <div key={s.id_sucursal} className="suc-card">
                <div className="suc-header">
                  <div>
                    <span className="suc-name">{s.ds_sucursal || `Sucursal ${s.id_sucursal}`}</span>
                    <span className="suc-sub">{fmt(s.tickets)} líneas · {fmt(s.unidades, 0)} unidades</span>
                  </div>
                  <div className="suc-total">{fmtMoney(s.total)}</div>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(s.total / maxTotal) * 100}%` }} />
                </div>
                <div className="suc-footer">
                  <span className="suc-meta">Top: <em>{s.topArticulo}</em></span>
                  <span className="suc-meta">Ticket prom: {fmtMoney(s.ticketPromedio)}</span>
                  <span className="suc-meta">Neto: {fmtMoney(s.neto)}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Panel por vendedor */}
        {tab === 'vendedor' && (
          <div className="analysis-panel">
            {porVendedor.map((v, i) => (
              <div key={v.ds_vendedor} className="suc-card">
                <div className="suc-header">
                  <div>
                    <span className="suc-name">
                      <span className="rank">#{i + 1}</span> {v.ds_vendedor}
                    </span>
                    <span className="suc-sub">{fmt(v.ventas)} líneas</span>
                  </div>
                  <div className="suc-total">{fmtMoney(v.total)}</div>
                </div>
                <div className="bar-track">
                  <div className="bar-fill bar-fill-2" style={{ width: `${(v.total / maxVend) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Panel top artículos */}
        {tab === 'articulo' && (
          <div className="analysis-panel">
            {topArticulos.map((a, i) => (
              <div key={a.id} className="suc-card">
                <div className="suc-header">
                  <div>
                    <span className="suc-name">
                      <span className="rank">#{i + 1}</span> {a.nombre || `Art. ${a.id}`}
                    </span>
                    <span className="suc-sub">{fmt(a.unidades, 0)} unidades · cód. {a.id}</span>
                  </div>
                  <div className="suc-total">{fmtMoney(a.total)}</div>
                </div>
                <div className="bar-track">
                  <div className="bar-fill bar-fill-3" style={{ width: `${(a.unidades / maxArt) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  )
}
