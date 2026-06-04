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
  prefin: number | null
}

type Bucket = 'todos' | '0-20' | '21-40' | '40+' | 'inmovilizado'

function getBucket(dias: number | null, vta: number): Exclude<Bucket, 'todos'> {
  if (vta === 0 || dias === null) return 'inmovilizado'
  if (dias <= 20) return '0-20'
  if (dias <= 40) return '21-40'
  return '40+'
}

const BUCKETS: { key: Bucket; label: string; cls: string }[] = [
  { key: 'todos',       label: 'Todos',       cls: 'c-todos'  },
  { key: '0-20',        label: '0–20 días',   cls: 'c-0-20'   },
  { key: '21-40',       label: '21–40 días',  cls: 'c-21-40'  },
  { key: '40+',         label: '+40 días',    cls: 'c-40plus' },
  { key: 'inmovilizado',label: 'Inmovilizado',cls: 'c-inmov'  },
]

function num(n: number | null, d = 0) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })
}
function money(n: number | null) {
  if (n === null || n === undefined) return '—'
  return '$\u00A0' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function StockPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deposito, setDeposito] = useState('todos')
  const [bucket, setBucket] = useState<Bucket>('todos')
  const [division, setDivision] = useState('todas')
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState<keyof StockRow>('dias_stock')
  const [sortAsc, setSortAsc] = useState(true)

  useEffect(() => {
    supabase.from('v_resumen_articulos').select('*')
      .then(({ data: rows, error: e }) => {
        if (e) setError(e.message)
        else setData(rows as StockRow[])
        setLoading(false)
      })
  }, [])

  const depositos = useMemo(() => {
    const m = new Map<number, string>()
    data.forEach(r => m.set(r.id_deposito, r.ds_deposito))
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [data])

  const divisiones = useMemo(() => {
    const s = new Set<string>()
    data.forEach(r => { if (r.division) s.add(r.division) })
    return Array.from(s).sort()
  }, [data])

  // Base filtrada por depósito (para KPIs)
  const base = useMemo(() =>
    deposito === 'todos' ? data : data.filter(r => r.id_deposito === Number(deposito))
  , [data, deposito])

  const kpis = useMemo(() => {
    const totalBultos   = base.reduce((s, r) => s + r.cant_bultos, 0)
    // Valorizado = cant_bultos * prefin
    const valorizado    = base.reduce((s, r) => s + (r.cant_bultos * (r.prefin ?? 0)), 0)
    const criticos      = base.filter(r => getBucket(r.dias_stock, r.vta_diaria) === '0-20').length
    const inmovilizados = base.filter(r => getBucket(r.dias_stock, r.vta_diaria) === 'inmovilizado').length
    const counts: Record<Bucket, number> = { todos: base.length, '0-20': 0, '21-40': 0, '40+': 0, inmovilizado: 0 }
    base.forEach(r => { counts[getBucket(r.dias_stock, r.vta_diaria)]++ })
    return { totalBultos, valorizado, criticos, inmovilizados, counts }
  }, [base])

  const filtered = useMemo(() => {
    return base.filter(r => {
      const b = getBucket(r.dias_stock, r.vta_diaria)
      if (bucket !== 'todos' && b !== bucket) return false
      if (division !== 'todas' && r.division !== division) return false
      if (search) {
        const q = search.toLowerCase()
        if (!r.ds_articulo?.toLowerCase().includes(q) && !String(r.id_articulo).includes(q) && !r.marca?.toLowerCase().includes(q)) return false
      }
      return true
    }).sort((a, b) => {
      const av = a[sortCol] ?? (sortAsc ? Infinity : -Infinity)
      const bv = b[sortCol] ?? (sortAsc ? Infinity : -Infinity)
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ? 1 : -1
      return 0
    })
  }, [base, bucket, division, search, sortCol, sortAsc])

  function sort(col: keyof StockRow) {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(true) }
  }
  function SI({ col }: { col: keyof StockRow }) {
    return <span className={`sort-ind ${sortCol === col ? 'on' : ''}`}>{sortCol === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
  }

  function diasClass(b: string) {
    if (b === '0-20') return 'dias-0-20'
    if (b === '21-40') return 'dias-21-40'
    if (b === '40+') return 'dias-40plus'
    return 'dias-inmov'
  }
  function diasLabel(dias: number | null, b: string) {
    if (b === 'inmovilizado') return 'Sin mov.'
    return dias !== null ? `${num(dias, 1)} d` : '—'
  }

  if (loading) return <div className="page-loading"><div className="spinner" /><span>Cargando inventario...</span></div>
  if (error) return <div className="page-loading"><span className="error-txt">Error: {error}</span></div>

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <Link to="/dashboard" className="topbar-brand">
          <div className="brand-icon">D</div>
          <span className="brand-name">Dricka SAS</span>
        </Link>
        <nav className="topbar-nav">
          <Link to="/dashboard" className="tnav-link">Inicio</Link>
          <Link to="/stock" className="tnav-link active">Stock</Link>
          <Link to="/ventas" className="tnav-link">Ventas</Link>
        </nav>
        <div className="topbar-right">
          <div className="user-chip">
            <div className="user-avatar">{(user?.username?.[0] ?? '?').toUpperCase()}</div>
            <span>{user?.username}</span>
          </div>
          <button className="btn-logout" onClick={() => { logout(); navigate('/login') }}>Salir</button>
        </div>
      </header>

      <div className="page-container">
        {/* Header */}
        <div className="page-header">
          <div className="breadcrumb">Gestión / Stock</div>
          <div className="page-header-inner">
            <div>
              <div className="page-title">Inventario valorizado</div>
              <div className="page-desc">Cobertura de stock según venta diaria ponderada · valorizado a precio de lista final</div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-row">
          <div className="kpi-card blue">
            <div className="kpi-label">Valorizado total</div>
            <div className="kpi-value">{money(kpis.valorizado)}</div>
            <div className="kpi-note">cant. bultos × precio final</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Bultos en stock</div>
            <div className="kpi-value">{num(kpis.totalBultos)}</div>
            <div className="kpi-note">{deposito === 'todos' ? 'Todos los depósitos' : depositos.find(([id]) => id === Number(deposito))?.[1]}</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Cobertura crítica</div>
            <div className="kpi-value">{kpis.criticos}</div>
            <div className="kpi-note">artículos con ≤ 20 días de stock</div>
          </div>
          <div className="kpi-card amber">
            <div className="kpi-label">Cobertura media</div>
            <div className="kpi-value">{kpis.counts['21-40']}</div>
            <div className="kpi-note">artículos entre 21 y 40 días</div>
          </div>
          <div className="kpi-card gray">
            <div className="kpi-label">Inmovilizados</div>
            <div className="kpi-value">{kpis.inmovilizados}</div>
            <div className="kpi-note">sin ventas en los últimos 20 días</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="field-group">
            <label className="field-label">Depósito</label>
            <select className="field-select" value={deposito} onChange={e => setDeposito(e.target.value)}>
              <option value="todos">Todos los depósitos</option>
              {depositos.map(([id, name]) => <option key={id} value={id}>{name || `Depósito ${id}`}</option>)}
            </select>
          </div>
          <div className="field-group">
            <label className="field-label">División</label>
            <select className="field-select" value={division} onChange={e => setDivision(e.target.value)}>
              <option value="todas">Todas las divisiones</option>
              {divisiones.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field-group grow">
            <label className="field-label">Buscar artículo</label>
            <input className="field-input" placeholder="Nombre, código o marca..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        {/* Bucket segments */}
        <div className="segment-bar">
          {BUCKETS.map(b => (
            <button key={b.key} className={`seg-btn ${b.cls} ${bucket === b.key ? 'active' : ''}`} onClick={() => setBucket(b.key)}>
              <span className="seg-dot" />
              {b.label}
              <span className="seg-count">{kpis.counts[b.key]}</span>
            </button>
          ))}
        </div>

        {/* Tabla */}
        <div className="table-card">
          <div className="table-card-header">
            <span className="table-card-title">Detalle por artículo</span>
            <span className="table-count-badge">{filtered.length} resultados</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => sort('id_articulo')}>Código <SI col="id_articulo" /></th>
                  <th className="sortable" onClick={() => sort('ds_articulo')}>Artículo <SI col="ds_articulo" /></th>
                  <th className="sortable" onClick={() => sort('division')}>División <SI col="division" /></th>
                  <th className="sortable" onClick={() => sort('marca')}>Marca <SI col="marca" /></th>
                  <th className="sortable r" onClick={() => sort('vta_diaria')}>Vta/día <SI col="vta_diaria" /></th>
                  <th className="sortable r" onClick={() => sort('cant_bultos')}>Bultos <SI col="cant_bultos" /></th>
                  <th className="sortable r" onClick={() => sort('dias_stock')}>Cobertura <SI col="dias_stock" /></th>
                  <th className="sortable r" onClick={() => sort('prefin')}>P. Final <SI col="prefin" /></th>
                  <th className="r">Valorizado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={9} className="td-empty">Sin resultados para los filtros aplicados</td></tr>
                )}
                {filtered.map((r, i) => {
                  const b = getBucket(r.dias_stock, r.vta_diaria)
                  const valorFila = r.cant_bultos * (r.prefin ?? 0)
                  return (
                    <tr key={`${r.id_deposito}-${r.id_articulo}-${i}`}>
                      <td className="td-code">{r.id_articulo}</td>
                      <td className="td-name">{r.ds_articulo || '—'}</td>
                      <td className="td-tag">{r.division || '—'}</td>
                      <td className="td-tag">{r.marca || '—'}</td>
                      <td className="td-r">{num(r.vta_diaria, 2)}</td>
                      <td className="td-r">{num(r.cant_bultos, 2)}</td>
                      <td className="td-r">
                        <span className={`dias-pill ${diasClass(b)}`}>{diasLabel(r.dias_stock, b)}</span>
                      </td>
                      <td className="td-r td-money">{money(r.prefin)}</td>
                      <td className="td-r td-money">{money(valorFila)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            {filtered.length} artículos · Depósito: {deposito === 'todos' ? 'todos' : depositos.find(([id]) => id === Number(deposito))?.[1] ?? deposito}
            {' · '}Valorizado filtrado: {money(filtered.reduce((s, r) => s + r.cant_bultos * (r.prefin ?? 0), 0))}
          </div>
        </div>
      </div>
    </div>
  )
}
