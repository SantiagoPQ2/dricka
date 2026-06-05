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
  precio_unitario: number | null
  precio_final: number | null
  presentacion: number | null
  valorizado: number | null
}

type Bucket = 'todos' | '0-7' | '7-15' | '15+' | 'inmovilizado'

function getBucket(dias: number | null, vta: number, bultos: number): Exclude<Bucket, 'todos'> {
  if (bultos > 0 && (vta === 0 || dias === null)) return 'inmovilizado'
  if (dias === null) return 'inmovilizado'
  if (dias <= 7)  return '0-7'
  if (dias <= 15) return '7-15'
  return '15+'
}

const BUCKETS: { key: Bucket; label: string; cls: string; desc: string }[] = [
  { key: 'todos',        label: 'Todos',        cls: 'c-todos',   desc: '' },
  { key: '0-7',          label: '0–7 días',     cls: 'c-0-7',     desc: 'Crítico' },
  { key: '7-15',         label: '7–15 días',    cls: 'c-7-15',    desc: 'Alerta' },
  { key: '15+',          label: '+15 días',     cls: 'c-15plus',  desc: 'Normal' },
  { key: 'inmovilizado', label: 'Inmovilizado', cls: 'c-inmov',   desc: 'Sin ventas 20d' },
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

  const base = useMemo(() =>
    deposito === 'todos' ? data : data.filter(r => r.id_deposito === Number(deposito))
  , [data, deposito])

  const kpis = useMemo(() => {
    const totalBultos = base.reduce((s, r) => s + r.cant_bultos, 0)
    const valorizado  = base.reduce((s, r) => s + (r.valorizado ?? 0), 0)
    const counts: Record<Bucket, number> = { todos: base.length, '0-7': 0, '7-15': 0, '15+': 0, inmovilizado: 0 }
    base.forEach(r => { counts[getBucket(r.dias_stock, r.vta_diaria, r.cant_bultos)]++ })
    return { totalBultos, valorizado, counts }
  }, [base])

  const filtered = useMemo(() => {
    return base.filter(r => {
      const b = getBucket(r.dias_stock, r.vta_diaria, r.cant_bultos)
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
  }, [base, bucket, division, search, sortCol, sortAsc])

  const valorizadoFiltrado = useMemo(() =>
    filtered.reduce((s, r) => s + (r.valorizado ?? 0), 0)
  , [filtered])

  function sort(col: keyof StockRow) {
    if (sortCol === col) setSortAsc(p => !p)
    else { setSortCol(col); setSortAsc(true) }
  }
  function SI({ col }: { col: keyof StockRow }) {
    return <span className={`sort-ind ${sortCol === col ? 'on' : ''}`}>{sortCol === col ? (sortAsc ? '↑' : '↓') : '↕'}</span>
  }
  function diasPill(dias: number | null, b: string) {
    const cls   = b === '0-7' ? 'dias-0-7' : b === '7-15' ? 'dias-7-15' : b === '15+' ? 'dias-15plus' : 'dias-inmov'
    const label = b === 'inmovilizado' ? 'Sin mov.' : dias !== null ? `${num(dias, 1)} d` : '—'
    return <span className={`dias-pill ${cls}`}>{label}</span>
  }

  if (loading) return <div className="page-loading"><div className="spinner" /><span>Cargando inventario...</span></div>
  if (error)   return <div className="page-loading"><span className="error-txt">Error: {error}</span></div>

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/dashboard" className="topbar-brand">
          <div className="brand-icon">D</div>
          <span className="brand-name">Dricka SAS</span>
        </Link>
        <nav className="topbar-nav">
          <Link to="/dashboard" className="tnav-link">Inicio</Link>
          <Link to="/stock"     className="tnav-link active">Stock</Link>
          <Link to="/ventas"    className="tnav-link">Ventas</Link>
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
        <div className="page-header">
          <div className="breadcrumb">Gestión / Stock</div>
          <div className="page-header-inner">
            <div>
              <div className="page-title">Inventario valorizado</div>
              <div className="page-desc">Cobertura según venta diaria ponderada (70% últ. 5d / 30% días 6–20) · valorizado = bultos × precio final</div>
            </div>
          </div>
        </div>

        <div className="kpi-row">
          <div className="kpi-card blue">
            <div className="kpi-label">Valorizado total</div>
            <div className="kpi-value">{money(kpis.valorizado)}</div>
            <div className="kpi-note">bultos × precio final</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Bultos en stock</div>
            <div className="kpi-value">{num(kpis.totalBultos)}</div>
            <div className="kpi-note">{deposito === 'todos' ? 'Todos los depósitos' : depositos.find(([id]) => id === Number(deposito))?.[1]}</div>
          </div>
          <div className="kpi-card red">
            <div className="kpi-label">Críticos ≤ 7 días</div>
            <div className="kpi-value">{kpis.counts['0-7']}</div>
            <div className="kpi-note">reposición urgente</div>
          </div>
          <div className="kpi-card amber">
            <div className="kpi-label">En alerta 7–15 días</div>
            <div className="kpi-value">{kpis.counts['7-15']}</div>
            <div className="kpi-note">planificar reposición</div>
          </div>
          <div className="kpi-card gray">
            <div className="kpi-label">Inmovilizados</div>
            <div className="kpi-value">{kpis.counts['inmovilizado']}</div>
            <div className="kpi-note">stock sin ventas en 20d</div>
          </div>
        </div>

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

        <div className="segment-bar">
          {BUCKETS.map(b => (
            <button key={b.key} className={`seg-btn ${b.cls} ${bucket === b.key ? 'active' : ''}`} onClick={() => setBucket(b.key)}>
              <span className="seg-dot" />
              <span>{b.label}</span>
              {b.desc && <span className="seg-desc">{b.desc}</span>}
              <span className="seg-count">{kpis.counts[b.key]}</span>
            </button>
          ))}
        </div>

        <div className="table-card">
          <div className="table-card-header">
            <span className="table-card-title">Detalle por artículo</span>
            <span className="table-count-badge">{filtered.length} resultados</span>
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => sort('id_deposito')}>Depósito <SI col="id_deposito" /></th>
                  <th className="sortable" onClick={() => sort('id_articulo')}>Código <SI col="id_articulo" /></th>
                  <th className="sortable" onClick={() => sort('ds_articulo')}>Artículo <SI col="ds_articulo" /></th>
                  <th className="sortable" onClick={() => sort('division')}>División <SI col="division" /></th>
                  <th className="sortable" onClick={() => sort('marca')}>Marca <SI col="marca" /></th>
                  <th className="r sortable" onClick={() => sort('presentacion')}>Present. <SI col="presentacion" /></th>
                  <th className="r sortable" onClick={() => sort('vta_diaria')}>Vta/día <SI col="vta_diaria" /></th>
                  <th className="r sortable" onClick={() => sort('cant_bultos')}>Bultos <SI col="cant_bultos" /></th>
                  <th className="r sortable" onClick={() => sort('cant_unidades')}>Unidades <SI col="cant_unidades" /></th>
                  <th className="r sortable" onClick={() => sort('dias_stock')}>Cobertura <SI col="dias_stock" /></th>
                  <th className="r sortable" onClick={() => sort('precio_unitario')}>P. Unit. <SI col="precio_unitario" /></th>
                  <th className="r sortable" onClick={() => sort('precio_final')}>P. Final <SI col="precio_final" /></th>
                  <th className="r sortable" onClick={() => sort('precio_compra')}>P. Compra <SI col="precio_compra" /></th>
                  <th className="r sortable" onClick={() => sort('valorizado')}>Valorizado <SI col="valorizado" /></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={14} className="td-empty">Sin resultados para los filtros aplicados</td></tr>
                )}
                {filtered.map((r, i) => {
                  const b = getBucket(r.dias_stock, r.vta_diaria, r.cant_bultos)
                  return (
                    <tr key={`${r.id_deposito}-${r.id_articulo}-${i}`}>
                      <td className="td-tag">{r.ds_deposito || `Dep. ${r.id_deposito}`}</td>
                      <td className="td-code">{r.id_articulo}</td>
                      <td className="td-name">{r.ds_articulo || '—'}</td>
                      <td className="td-tag">{r.division || '—'}</td>
                      <td className="td-tag">{r.marca || '—'}</td>
                      <td className="td-r">{num(r.presentacion)}</td>
                      <td className="td-r">{num(r.vta_diaria, 2)}</td>
                      <td className="td-r">{num(r.cant_bultos, 2)}</td>
                      <td className="td-r">{num(r.cant_unidades, 2)}</td>
                      <td className="td-r">{diasPill(r.dias_stock, b)}</td>
                      <td className="td-r td-money">{money(r.precio_unitario)}</td>
                      <td className="td-r td-money">{money(r.precio_final)}</td>
                      <td className="td-r td-money">{money(r.precio_compra)}</td>
                      <td className="td-r td-money td-bold">{money(r.valorizado)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span>{filtered.length} artículos · Depósito: {deposito === 'todos' ? 'todos' : depositos.find(([id]) => id === Number(deposito))?.[1] ?? deposito}</span>
            <span className="footer-total">Valorizado filtrado: <strong>{money(valorizadoFiltrado)}</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}
