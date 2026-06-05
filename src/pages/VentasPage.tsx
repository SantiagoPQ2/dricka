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
  anulado: string
}

function fmt(n: number, d = 0) { return n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d }) }
function money(n: number)      { return '$\u00A0' + n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) }

function toISO(d: Date) { return d.toISOString().split('T')[0] }

// Resta N meses a una fecha
function subtractMonth(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() - months)
  return toISO(d)
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000)
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Porcentaje de variación
function varPct(actual: number, anterior: number): { val: number; label: string; cls: string } {
  if (anterior === 0) return { val: 0, label: '—', cls: '' }
  const v = ((actual - anterior) / anterior) * 100
  return {
    val: v,
    label: (v >= 0 ? '+' : '') + v.toFixed(1) + '%',
    cls: v >= 0 ? 'var-pos' : 'var-neg'
  }
}

export function VentasPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  // Período actual: por defecto desde el 1ro del mes hasta hoy
  const today = toISO(new Date())
  const firstOfMonth = today.substring(0, 8) + '01'

  const [desde, setDesde] = useState(firstOfMonth)
  const [hasta, setHasta] = useState(today)
  const [sucursal, setSucursal] = useState('todas')
  const [tab, setTab] = useState<'sucursal' | 'vendedor' | 'articulo'>('sucursal')

  const [actual, setActual] = useState<VentaRow[]>([])
  const [anterior, setAnterior] = useState<VentaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Período anterior: mismo rango de días, mes anterior
  const desdeAnt = useMemo(() => subtractMonth(desde, 1), [desde])
  const hastaAnt = useMemo(() => subtractMonth(hasta, 1), [hasta])
  const dias     = useMemo(() => daysBetween(desde, hasta) + 1, [desde, hasta])

  useEffect(() => {
    if (!desde || !hasta || desde > hasta) return
    setLoading(true)

    const q = (d: string, h: string) =>
      supabase
        .from('chess_ventas')
        .select('fecha_comprobante,id_sucursal,ds_sucursal,id_vendedor,ds_vendedor,id_articulo,ds_articulo,id_cliente,nombre_cliente,cantidades_total,subtotal_neto,subtotal_final,anulado')
        .eq('anulado', 'NO')
        .gte('fecha_comprobante', d)
        .lte('fecha_comprobante', h)
        .not('id_articulo', 'is', null)

    Promise.all([q(desde, hasta), q(desdeAnt, hastaAnt)])
      .then(([r1, r2]) => {
        if (r1.error) { setError(r1.error.message); return }
        if (r2.error) { setError(r2.error.message); return }
        setActual(r1.data as VentaRow[])
        setAnterior(r2.data as VentaRow[])
        setLoading(false)
      })
  }, [desde, hasta, desdeAnt, hastaAnt])

  const sucursales = useMemo(() => {
    const m = new Map<number, string>()
    actual.forEach(r => m.set(r.id_sucursal, r.ds_sucursal))
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [actual])

  function filterBySuc(rows: VentaRow[]) {
    return sucursal === 'todas' ? rows : rows.filter(r => r.id_sucursal === Number(sucursal))
  }

  const baseAct = useMemo(() => filterBySuc(actual),  [actual,  sucursal])
  const baseAnt = useMemo(() => filterBySuc(anterior), [anterior, sucursal])

  // KPIs comparativos
  const kpis = useMemo(() => {
    const totalAct  = baseAct.reduce((s, r) => s + r.subtotal_final, 0)
    const totalAnt  = baseAnt.reduce((s, r) => s + r.subtotal_final, 0)
    const netoAct   = baseAct.reduce((s, r) => s + r.subtotal_neto,  0)
    const unidAct   = baseAct.reduce((s, r) => s + r.cantidades_total, 0)
    const unidAnt   = baseAnt.reduce((s, r) => s + r.cantidades_total, 0)
    const clientAct = new Set(baseAct.map(r => r.id_cliente)).size
    const clientAnt = new Set(baseAnt.map(r => r.id_cliente)).size
    return {
      totalAct, totalAnt, netoAct,
      unidAct, unidAnt, clientAct, clientAnt,
      varTotal:   varPct(totalAct, totalAnt),
      varUnid:    varPct(unidAct, unidAnt),
      varClients: varPct(clientAct, clientAnt),
    }
  }, [baseAct, baseAnt])

  // Por sucursal
  const porSucursal = useMemo(() => {
    const m = new Map<number, { id: number; nombre: string; act: number; ant: number; lineas: number; unidades: number; artMap: Map<string, number> }>()
    actual.forEach(r => {
      if (!m.has(r.id_sucursal)) m.set(r.id_sucursal, { id: r.id_sucursal, nombre: r.ds_sucursal, act: 0, ant: 0, lineas: 0, unidades: 0, artMap: new Map() })
      const s = m.get(r.id_sucursal)!
      s.act += r.subtotal_final; s.lineas++; s.unidades += r.cantidades_total
      s.artMap.set(r.ds_articulo, (s.artMap.get(r.ds_articulo) ?? 0) + r.cantidades_total)
    })
    anterior.forEach(r => {
      if (!m.has(r.id_sucursal)) m.set(r.id_sucursal, { id: r.id_sucursal, nombre: r.ds_sucursal, act: 0, ant: 0, lineas: 0, unidades: 0, artMap: new Map() })
      m.get(r.id_sucursal)!.ant += r.subtotal_final
    })
    return Array.from(m.values()).map(s => ({
      ...s,
      topArt: Array.from(s.artMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
      var: varPct(s.act, s.ant),
    })).sort((a, b) => b.act - a.act)
  }, [actual, anterior])

  // Por vendedor
  const porVendedor = useMemo(() => {
    const mAct = new Map<string, number>()
    const mAnt = new Map<string, number>()
    baseAct.forEach(r => { const k = r.ds_vendedor || 'Sin asignar'; mAct.set(k, (mAct.get(k) ?? 0) + r.subtotal_final) })
    baseAnt.forEach(r => { const k = r.ds_vendedor || 'Sin asignar'; mAnt.set(k, (mAnt.get(k) ?? 0) + r.subtotal_final) })
    const keys = new Set([...mAct.keys(), ...mAnt.keys()])
    return Array.from(keys).map(k => ({
      nombre: k,
      act: mAct.get(k) ?? 0,
      ant: mAnt.get(k) ?? 0,
      var: varPct(mAct.get(k) ?? 0, mAnt.get(k) ?? 0),
    })).sort((a, b) => b.act - a.act).slice(0, 15)
  }, [baseAct, baseAnt])

  // Top artículos
  const topArticulos = useMemo(() => {
    const mAct = new Map<number, { id: number; nombre: string; unid: number; total: number }>()
    const mAnt = new Map<number, number>()
    baseAct.forEach(r => {
      if (!mAct.has(r.id_articulo)) mAct.set(r.id_articulo, { id: r.id_articulo, nombre: r.ds_articulo, unid: 0, total: 0 })
      const a = mAct.get(r.id_articulo)!; a.unid += r.cantidades_total; a.total += r.subtotal_final
    })
    baseAnt.forEach(r => mAnt.set(r.id_articulo, (mAnt.get(r.id_articulo) ?? 0) + r.subtotal_final))
    return Array.from(mAct.values()).map(a => ({
      ...a,
      ant: mAnt.get(a.id) ?? 0,
      var: varPct(a.total, mAnt.get(a.id) ?? 0),
    })).sort((a, b) => b.total - a.total).slice(0, 20)
  }, [baseAct, baseAnt])

  const maxSuc  = useMemo(() => Math.max(...porSucursal.map(s => Math.max(s.act, s.ant)), 1), [porSucursal])
  const maxVend = useMemo(() => Math.max(...porVendedor.map(v => Math.max(v.act, v.ant)), 1), [porVendedor])
  const maxArt  = useMemo(() => Math.max(...topArticulos.map(a => Math.max(a.total, a.ant)), 1), [topArticulos])

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
              <div className="page-desc">
                Período actual vs. mismo período del mes anterior · solo comprobantes con venta
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="toolbar">
          <div className="field-group">
            <label className="field-label">Desde</label>
            <input type="date" className="field-input field-date" value={desde} onChange={e => setDesde(e.target.value)} />
          </div>
          <div className="field-group">
            <label className="field-label">Hasta</label>
            <input type="date" className="field-input field-date" value={hasta} onChange={e => setHasta(e.target.value)} max={today} />
          </div>
          <div className="field-group">
            <label className="field-label">Sucursal</label>
            <select className="field-select" value={sucursal} onChange={e => setSucursal(e.target.value)}>
              <option value="todas">Todas las sucursales</option>
              {sucursales.map(([id, name]) => <option key={id} value={id}>{name || `Sucursal ${id}`}</option>)}
            </select>
          </div>
          <div className="comp-badge">
            <div className="comp-badge-label">Comparando contra</div>
            <div className="comp-badge-value">{formatDate(desdeAnt)} – {formatDate(hastaAnt)}</div>
            <div className="comp-badge-sub">{dias} días cada período</div>
          </div>
        </div>

        {/* KPIs */}
        <div className="kpi-row">
          <div className="kpi-card blue">
            <div className="kpi-label">Total facturado</div>
            <div className="kpi-value">{money(kpis.totalAct)}</div>
            <div className="kpi-compare">
              <span className={kpis.varTotal.cls}>{kpis.varTotal.label}</span>
              <span className="comp-vs">vs. {money(kpis.totalAnt)}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Neto sin IVA</div>
            <div className="kpi-value">{money(kpis.netoAct)}</div>
            <div className="kpi-note">IVA: {money(kpis.totalAct - kpis.netoAct)}</div>
          </div>
          <div className="kpi-card green">
            <div className="kpi-label">Unidades vendidas</div>
            <div className="kpi-value">{fmt(kpis.unidAct)}</div>
            <div className="kpi-compare">
              <span className={kpis.varUnid.cls}>{kpis.varUnid.label}</span>
              <span className="comp-vs">vs. {fmt(kpis.unidAnt)}</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">Clientes únicos</div>
            <div className="kpi-value">{fmt(kpis.clientAct)}</div>
            <div className="kpi-compare">
              <span className={kpis.varClients.cls}>{kpis.varClients.label}</span>
              <span className="comp-vs">vs. {fmt(kpis.clientAnt)}</span>
            </div>
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

            {/* Header comparativo */}
            <div className="comp-header">
              <div className="comp-col-act">
                <span className="comp-dot dot-act" /> {formatDate(desde)} – {formatDate(hasta)}
              </div>
              <div className="comp-col-ant">
                <span className="comp-dot dot-ant" /> {formatDate(desdeAnt)} – {formatDate(hastaAnt)}
              </div>
              <div className="comp-col-var">Variación</div>
            </div>

            {tab === 'sucursal' && porSucursal.map(s => (
              <div key={s.id} className="row-card">
                <div className="row-card-top">
                  <div className="row-name-block">
                    <div className="row-name">{s.nombre || `Sucursal ${s.id}`}</div>
                    <div className="row-meta">{fmt(s.lineas)} líneas · {fmt(s.unidades)} unidades · Top: {s.topArt}</div>
                  </div>
                  <div className="comp-values">
                    <span className="comp-act">{money(s.act)}</span>
                    <span className="comp-ant">{money(s.ant)}</span>
                    <span className={`comp-var ${s.var.cls}`}>{s.var.label}</span>
                  </div>
                </div>
                <div className="bar-double-track">
                  <div className="bar-double-act"  style={{ width: `${(s.act / maxSuc) * 100}%` }} />
                  <div className="bar-double-ant"  style={{ width: `${(s.ant / maxSuc) * 100}%` }} />
                </div>
              </div>
            ))}

            {tab === 'vendedor' && porVendedor.map((v, i) => (
              <div key={v.nombre} className="row-card">
                <div className="row-card-top">
                  <div className="row-name-block">
                    <div className="row-name"><span className="rank-badge">#{i + 1}</span>{v.nombre}</div>
                  </div>
                  <div className="comp-values">
                    <span className="comp-act">{money(v.act)}</span>
                    <span className="comp-ant">{money(v.ant)}</span>
                    <span className={`comp-var ${v.var.cls}`}>{v.var.label}</span>
                  </div>
                </div>
                <div className="bar-double-track">
                  <div className="bar-double-act" style={{ width: `${(v.act / maxVend) * 100}%` }} />
                  <div className="bar-double-ant" style={{ width: `${(v.ant / maxVend) * 100}%` }} />
                </div>
              </div>
            ))}

            {tab === 'articulo' && topArticulos.map((a, i) => (
              <div key={a.id} className="row-card">
                <div className="row-card-top">
                  <div className="row-name-block">
                    <div className="row-name"><span className="rank-badge">#{i + 1}</span>{a.nombre || `Art. ${a.id}`}</div>
                    <div className="row-meta">{fmt(a.unid)} unidades · cód. {a.id}</div>
                  </div>
                  <div className="comp-values">
                    <span className="comp-act">{money(a.total)}</span>
                    <span className="comp-ant">{money(a.ant)}</span>
                    <span className={`comp-var ${a.var.cls}`}>{a.var.label}</span>
                  </div>
                </div>
                <div className="bar-double-track">
                  <div className="bar-double-act" style={{ width: `${(a.total / maxArt) * 100}%` }} />
                  <div className="bar-double-ant" style={{ width: `${(a.ant  / maxArt) * 100}%` }} />
                </div>
              </div>
            ))}

          </div>
        </div>
      </div>
    </div>
  )
}
