import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import '../styles/stock.css'

interface StockRow {
  id_deposito: number
  ds_deposito: string
  id_articulo: number
  ds_articulo: string
  compania: string | null
  division: string | null
  linea_de_producto: string | null
  marca: string | null
  unidad_de_negocio: string | null
  vta_diaria: number
  cant_bultos: number
  cant_unidades: number
  dias_stock: number | null
  precio_compra: number | null
  precio_lista: number | null
  precio_final: number | null
}

type Bucket = '0-20' | '21-40' | '40+' | 'inmovilizado' | 'todos'

const BUCKET_LABELS: Record<Bucket, string> = {
  'todos':        'TODOS',
  '0-20':         '0–20 DÍAS',
  '21-40':        '21–40 DÍAS',
  '40+':          '+40 DÍAS',
  'inmovilizado': 'INMOVILIZADO',
}

const BUCKET_COLORS: Record<Bucket, string> = {
  'todos':        '#e8ff47',
  '0-20':         '#ff5c5c',
  '21-40':        '#ffaa47',
  '40+':          '#47c8ff',
  'inmovilizado': '#6b6b8a',
}

function getBucket(dias: number | null, vta: number): Bucket {
  if (vta === 0 || dias === null) return 'inmovilizado'
  if (dias <= 20) return '0-20'
  if (dias <= 40) return '21-40'
  return '40+'
}

function fmt(n: number | null, decimals = 0): string {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtMoney(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return '$\u00A0' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function StockPage() {
  const { logout } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [deposito, setDeposito] = useState<string>('todos')
  const [bucket, setBucket] = useState<Bucket>('todos')
  const [division, setDivision] = useState<string>('todas')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<keyof StockRow>('dias_stock')
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: rows, error: err } = await supabase
        .from('v_resumen_articulos')
        .select('*')
        .order('dias_stock', { ascending: true, nullsFirst: false })
      if (err) { setError(err.message); setLoading(false); return }
      setData(rows as StockRow[])
      setLoading(false)
    }
    load()
  }, [])

  const depositos = useMemo(() => {
    const map = new Map<number, string>()
    data.forEach(r => map.set(r.id_deposito, r.ds_deposito))
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0])
  }, [data])

  const divisiones = useMemo(() => {
    const set = new Set<string>()
    data.forEach(r => { if (r.division) set.add(r.division) })
    return Array.from(set).sort()
  }, [data])

  const filtered = useMemo(() => {
    return data.filter(r => {
      if (deposito !== 'todos' && r.id_deposito !== Number(deposito)) return false
      const b = getBucket(r.dias_stock, r.vta_diaria)
      if (bucket !== 'todos' && b !== bucket) return false
      if (division !== 'todas' && r.division !== division) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !r.ds_articulo?.toLowerCase().includes(q) &&
          !String(r.id_articulo).includes(q) &&
          !r.marca?.toLowerCase().includes(q)
        ) return false
      }
      return true
    }).sort((a, b) => {
      const av = a[sortCol] ?? (sortAsc ? Infinity : -Infinity)
      const bv = b[sortCol] ?? (sortAsc ? Infinity : -Infinity)
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
  }, [data, deposito, bucket, division, search, sortCol, sortAsc])

  // KPIs globales (con filtro de depósito aplicado)
  const base = useMemo(() => deposito === 'todos' ? data : data.filter(r => r.id_deposito === Number(deposito)), [data, deposito])

  const kpis = useMemo(() => {
    const totalBultos = base.reduce((s, r) => s + r.cant_bultos, 0)
    const valorizado = base.reduce((s, r) => s + (r.cant_unidades * (r.precio_compra ?? 0)), 0)
    const valorizadoFinal = base.reduce((s, r) => s + (r.cant_unidades * (r.precio_final ?? 0)), 0)
    const sinMovimiento = base.filter(r => getBucket(r.dias_stock, r.vta_diaria) === 'inmovilizado').length
    const criticos = base.filter(r => r.dias_stock !== null && r.dias_stock <= 20 && r.vta_diaria > 0).length
    const bucketCounts: Record<Bucket, number> = { 'todos': base.length, '0-20': 0, '21-40': 0, '40+': 0, 'inmovilizado': 0 }
    base.forEach(r => { bucketCounts[getBucket(r.dias_stock, r.vta_diaria)]++ })
    return { totalBultos, valorizado, valorizadoFinal, sinMovimiento, criticos, bucketCounts }
  }, [base])

  function toggleSort(col: keyof StockRow) {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(true) }
  }

  function SortIcon({ col }: { col: keyof StockRow }) {
    if (sortCol !== col) return <span className="sort-icon muted">↕</span>
    return <span className="sort-icon active">{sortAsc ? '↑' : '↓'}</span>
  }

  if (loading) return (
    <div className="page-loading">
      <div className="loading-spinner" />
      <span>Cargando stock...</span>
    </div>
  )

  if (error) return (
    <div className="page-loading">
      <span className="error-msg">Error: {error}</span>
    </div>
  )

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
            <Link to="/stock" className="nav-link active">STOCK</Link>
            <Link to="/ventas" className="nav-link">VENTAS</Link>
          </nav>
        </div>
        <button className="logout-btn" onClick={() => { logout(); navigate('/login') }}>
          SALIR <span>→</span>
        </button>
      </header>

      <main className="stock-main">

        {/* Título */}
        <div className="page-title-block">
          <span className="page-tag">ANÁLISIS DE STOCK</span>
          <h1 className="page-title">Inventario <em>valorizado</em></h1>
          <p className="page-sub">Cobertura de días según venta diaria ponderada (70% últimos 5d / 30% días 6–20)</p>
        </div>

        {/* Filtros */}
        <div className="filters-bar">
          <div className="filter-group">
            <label className="filter-label">DEPÓSITO</label>
            <select className="filter-select" value={deposito} onChange={e => setDeposito(e.target.value)}>
              <option value="todos">Todos</option>
              {depositos.map(([id, name]) => (
                <option key={id} value={id}>{name || `Depósito ${id}`}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <label className="filter-label">DIVISIÓN</label>
            <select className="filter-select" value={division} onChange={e => setDivision(e.target.value)}>
              <option value="todas">Todas</option>
              {divisiones.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="filter-group search-group">
            <label className="filter-label">BUSCAR</label>
            <input
              className="filter-input"
              placeholder="Artículo, código, marca..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <span className="kpi-label">STOCK TOTAL (BULTOS)</span>
            <span className="kpi-value">{fmt(kpis.totalBultos)}</span>
          </div>
          <div className="kpi-card accent">
            <span className="kpi-label">VALORIZADO COSTO</span>
            <span className="kpi-value">{fmtMoney(kpis.valorizado)}</span>
          </div>
          <div className="kpi-card accent2">
            <span className="kpi-label">VALORIZADO PRECIO FINAL</span>
            <span className="kpi-value">{fmtMoney(kpis.valorizadoFinal)}</span>
          </div>
          <div className="kpi-card warn">
            <span className="kpi-label">ARTÍCULOS CRÍTICOS ≤20d</span>
            <span className="kpi-value">{fmt(kpis.criticos)}</span>
          </div>
          <div className="kpi-card muted">
            <span className="kpi-label">INMOVILIZADOS</span>
            <span className="kpi-value">{fmt(kpis.sinMovimiento)}</span>
          </div>
        </div>

        {/* Bucket tabs */}
        <div className="bucket-tabs">
          {(Object.keys(BUCKET_LABELS) as Bucket[]).map(b => (
            <button
              key={b}
              className={`bucket-tab ${bucket === b ? 'active' : ''}`}
              style={{ '--tab-color': BUCKET_COLORS[b] } as React.CSSProperties}
              onClick={() => setBucket(b)}
            >
              <span className="tab-dot" />
              <span>{BUCKET_LABELS[b]}</span>
              <span className="tab-count">{kpis.bucketCounts[b]}</span>
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="table-wrap">
          <table className="stock-table">
            <thead>
              <tr>
                <th onClick={() => toggleSort('id_articulo')} className="th-sort">COD <SortIcon col="id_articulo" /></th>
                <th onClick={() => toggleSort('ds_articulo')} className="th-sort">ARTÍCULO <SortIcon col="ds_articulo" /></th>
                <th onClick={() => toggleSort('division')} className="th-sort">DIVISIÓN <SortIcon col="division" /></th>
                <th onClick={() => toggleSort('marca')} className="th-sort">MARCA <SortIcon col="marca" /></th>
                <th onClick={() => toggleSort('vta_diaria')} className="th-sort th-num">VTA/DÍA <SortIcon col="vta_diaria" /></th>
                <th onClick={() => toggleSort('cant_bultos')} className="th-sort th-num">BULTOS <SortIcon col="cant_bultos" /></th>
                <th onClick={() => toggleSort('cant_unidades')} className="th-sort th-num">UNIDADES <SortIcon col="cant_unidades" /></th>
                <th onClick={() => toggleSort('dias_stock')} className="th-sort th-num">DÍAS STOCK <SortIcon col="dias_stock" /></th>
                <th onClick={() => toggleSort('precio_compra')} className="th-sort th-num">P. COMPRA <SortIcon col="precio_compra" /></th>
                <th onClick={() => toggleSort('precio_final')} className="th-sort th-num">P. FINAL <SortIcon col="precio_final" /></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} className="td-empty">Sin resultados</td></tr>
              )}
              {filtered.map((r, i) => {
                const b = getBucket(r.dias_stock, r.vta_diaria)
                return (
                  <tr key={`${r.id_deposito}-${r.id_articulo}-${i}`} className={`tr-bucket-${b}`}>
                    <td className="td-mono">{r.id_articulo}</td>
                    <td className="td-name">{r.ds_articulo || '—'}</td>
                    <td className="td-tag">{r.division || '—'}</td>
                    <td className="td-tag">{r.marca || '—'}</td>
                    <td className="td-num">{fmt(r.vta_diaria, 2)}</td>
                    <td className="td-num">{fmt(r.cant_bultos, 2)}</td>
                    <td className="td-num">{fmt(r.cant_unidades, 2)}</td>
                    <td className="td-num">
                      <span className={`dias-badge dias-${b}`}>
                        {r.dias_stock !== null ? fmt(r.dias_stock, 1) : '∞'}
                      </span>
                    </td>
                    <td className="td-num td-money">{fmtMoney(r.precio_compra)}</td>
                    <td className="td-num td-money">{fmtMoney(r.precio_final)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span className="mono muted">{filtered.length} artículos · depósito: {deposito === 'todos' ? 'todos' : depositos.find(([id]) => id === Number(deposito))?.[1] ?? deposito}</span>
        </div>
      </main>
    </div>
  )
}
