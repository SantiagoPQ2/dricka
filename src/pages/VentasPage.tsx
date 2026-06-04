import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import '../styles/stock.css'

interface VentaRow {
  fecha_comprobante: string
  id_sucursal: number
  ds_sucursal: string
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

const PERIODOS = [
  { label: 'Hoy',     days: 0  },
  { label: '7 días',  days: 7  },
  { label: '15 días', days: 15 },
  { label: '30 días', days: 30 },
]

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]
}
function num(n: number, d = 0) { return n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) }
function money(n: number)      { return '$\u00A0' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

export function VentasPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState<VentaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [periodo, setPeriodo] = useState(7)
  const [sucursal, setSucursal] = useState('todas')
  const [tab, setTab] = useState<'sucursal' | 'vendedor' | 'articulo'>('sucursal')

  useEffect(() => {
    setLoading(true)
    const desde = periodo === 0 ? daysAgo(0) : daysAgo(periodo)
    supabase.from('chess_ventas')
      .select('fecha_comprobante,id_sucursal,ds_sucursal,id_vendedor,ds_vendedor,id_articulo,ds_articulo,id_cliente,nombre_cliente,cantidades_total,subtotal_neto,subtotal_final,iva21,iva105,anulado')
      .eq('anulado', 'NO')
      .gte('fecha_comprobante', desde)
      .not('id_articulo', 'is', null)
      .then(({ data: rows, error: e }) => {
        if (e) setError(e.message)
        else setData(rows as VentaRow[])
        setLoading(false)
      })
  }, [periodo])

  const sucursales = useMemo(() => {
    const m = new Map<number, string>()
    data.forEach(r => m.set(r.id_sucursal, r.ds_sucursal))
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [data])

  const base = useMemo(() =>
    sucursal === 'todas' ? data : data.filter(r => r.id_sucursal === Number(sucursal))
  , [data, sucursal])

  const kpis = useMemo(() => ({
    total:    base.reduce((s, r) => s + r.subtotal_final, 0),
    neto:     base.reduce((s, r) => s + r.subtotal_neto,  0),
    unidades: base.reduce((s, r) => s + r.cantidades_total, 0),
    clientes: new Set(base.map(r => r.id_cliente)).size,
    lineas:   base.length,
  }), [base])

  const porSucursal = useMemo(() => {
    const m = new Map<number, { id: number; nombre: string; total: number; neto: number; lineas: number; unidades: number; artMap: Map<string, number> }>()
    data.forEach(r => {
      if (!m.has(r.id_sucursal)) m.set(r.id_sucursal, { id: r.id_sucursal, nombre: r.ds_sucursal, total: 0, neto: 0, lineas: 0, unidades: 0, artMap: new Map() })
      const s = m.get(r.id_sucursal)!
      s.total    += r.subtotal_final; s.neto += r.subtotal_neto
      s.lineas++; s.unidades += r.cantidades_total
      s.artMap.set(r.ds_articulo, (s.artMap.get(r.ds_articulo) ?? 0) + r.cantidades_total)
    })
    return Array.from(m.values()).map(s => ({
      ...s,
      topArt: Array.from(s.artMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
    })).sort((a, b) => b.total - a.total)
  }, [data])

  const porVendedor = useMemo(() => {
    const m = new Map<string, { nombre: string; total: number; lineas: number }>()
    base.forEach(r => {
      const k = r.ds_vendedor || 'Sin asignar'
      if (!m.has(k)) m.set(k, { nombre: k, total: 0, lineas: 0 })
      const v = m.get(k)!; v.total += r.subtotal_final; v.lineas++
    })
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 15)
  }, [base])

  const topArticulos = useMemo(() => {
    const m = new Map<number, { id: number; nombre: string; unidades: number; total: number }>()
    base.forEach(r => {
      if (!m.has(r.id_articulo)) m.set(r.id_articulo, { id: r.id_articulo, nombre: r.ds_articulo, unidades: 0, total: 0 })
      const a = m.get(r.id_articulo)!; a.unidades += r.cantidades_total; a.total += r.subtotal_final
    })
    return Array.from(m.values()).sort((a, b) => b.total - a.total).slice(0, 20)
  }, [base])

  const maxSuc  = useMemo(() => Math.max(...porSucursal.map(s => s.total), 1), [porSucursal])
  const maxVend = useMemo(() => Math.max(...porVendedor.map(v => v.total), 1), [porVendedor])
  const maxArt  = useMemo(() => Math.max(...topArticulos.map(a => a.total), 1), [topArticulos])

  if (loading) return <div className="page-loading"><div className="spinner" /><span>Cargando ventas...</span></div>
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
          <Link to="/stock"     className="tnav-link">Stock</Link>
          <Link to="/ventas"    className="tnav-link active">Ventas</Link>
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
          <div className="breadcrumb">Gestión / Ventas</div>
          <div className="page-header-inner">
            <div>
              <div className="page-title">Análisis de ventas</div>
              <div className="page-desc">Comprobantes facturados · excluye anulados · datos de Chess ERP</div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="field-group">
            <label className="field-label">Período</label>
            <div className="period-tabs">
              {PERIODOS.map(p => (
                <button key={p.days} className={`ptab ${periodo === p.days ? 'active' : ''}`} onClick={() => setPeriodo(p.days)}>{p.label}</button>
              ))}
            </div>
          </div>
          <div className="field-group">
            <label className="field-label">Sucursal</label>
            <select className="field-select" value={sucursal} onChange={e => setSucursal(e.target.value)}>
              <option value="todas">Todas las sucursales</option>
              {sucursales.map(([id, name]) => <option key={id} value={id}>{name || `Sucursal ${id}`}</option>)}
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-row">
          <div className="kpi-card blue">
            <div className="kpi-label">Total facturado</div>
            <div className="kpi-value">{money(kpis.total)}</div>
            <div className="kpi-note">con IVA incluido</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Neto sin IVA</div>
            <div className="kpi-value">{money(kpis.neto)}</div>
            <div className="kpi-note">IVA: {money(kpis.total - kpis.neto)}</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Unidades vendidas</div>
            <div className="kpi-value">{num(kpis.unidades)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Clientes únicos</div>
            <div className="kpi-value">{num(kpis.clientes)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Líneas de venta</div>
            <div className="kpi-value">{num(kpis.lineas)}</div>
          </div>
        </div>

        {/* Panel con tabs */}
        <div className="table-card">
          <div className="atabs">
            {(['sucursal', 'vendedor', 'articulo'] as const).map(t => (
              <button key={t} className={`atab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                {t === 'sucursal' ? 'Por sucursal' : t === 'vendedor' ? 'Por vendedor' : 'Top artículos'}
              </button>
            ))}
          </div>

          <div className="apanel">
            {tab === 'sucursal' && porSucursal.map(s => (
              <div key={s.id} className="row-card">
                <div className="row-card-top">
                  <div>
                    <div className="row-name">{s.nombre || `Sucursal ${s.id}`}</div>
                    <div className="row-meta">{num(s.lineas)} líneas · {num(s.unidades)} unidades</div>
                  </div>
                  <div className="row-total">{money(s.total)}</div>
                </div>
                <div className="bar-track">
                  <div className="bar-fill fill-blue" style={{ width: `${(s.total / maxSuc) * 100}%` }} />
                </div>
                <div className="row-card-bottom">
                  <span>Neto: <em>{money(s.neto)}</em></span>
                  <span>IVA: <em>{money(s.total - s.neto)}</em></span>
                  <span>Top artículo: <em>{s.topArt}</em></span>
                </div>
              </div>
            ))}

            {tab === 'vendedor' && porVendedor.map((v, i) => (
              <div key={v.nombre} className="row-card">
                <div className="row-card-top">
                  <div>
                    <div className="row-name"><span className="rank-badge">#{i + 1}</span>{v.nombre}</div>
                    <div className="row-meta">{num(v.lineas)} líneas de venta</div>
                  </div>
                  <div className="row-total">{money(v.total)}</div>
                </div>
                <div className="bar-track">
                  <div className="bar-fill fill-teal" style={{ width: `${(v.total / maxVend) * 100}%` }} />
                </div>
              </div>
            ))}

            {tab === 'articulo' && topArticulos.map((a, i) => (
              <div key={a.id} className="row-card">
                <div className="row-card-top">
                  <div>
                    <div className="row-name"><span className="rank-badge">#{i + 1}</span>{a.nombre || `Art. ${a.id}`}</div>
                    <div className="row-meta">{num(a.unidades)} unidades · cód. {a.id}</div>
                  </div>
                  <div className="row-total">{money(a.total)}</div>
                </div>
                <div className="bar-track">
                  <div className="bar-fill fill-purp" style={{ width: `${(a.total / maxArt) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
