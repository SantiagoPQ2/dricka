import { useEffect, useState, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// ─── Tipos ────────────────────────────────────────────────────────────────────

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
  ds_documento: string
}

interface Agrupacion {
  codigo: number
  articulo: string
  division: string
  linea_de_producto: string
  marca: string
  unidad_de_negocio: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const money = (n: number) =>
  (n < 0 ? '-' : '') + '$\u00A0' + Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

const fmt = (n: number, d = 0) =>
  n.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d })

const pct = (n: number) => (n >= 0 ? '+' : '') + n.toFixed(1) + '%'

const toISO = (d: Date) => d.toISOString().split('T')[0]

function subtractMonth(s: string, m: number) {
  const d = new Date(s); d.setMonth(d.getMonth() - m); return toISO(d)
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
}

function formatDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function varPct(act: number, ant: number) {
  if (ant === 0) return { v: 0, label: '—', cls: 'neutral' }
  const v = ((act - ant) / Math.abs(ant)) * 100
  return { v, label: pct(v), cls: v >= 0 ? 'pos' : 'neg' }
}

function esDevolucion(doc: string) {
  return doc?.toLowerCase().includes('devol')
}

// ─── Fetch con paginación ─────────────────────────────────────────────────────

async function fetchAll(d: string, h: string): Promise<VentaRow[]> {
  const PAGE = 5000
  let all: VentaRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('chess_ventas')
      .select('fecha_comprobante,id_sucursal,ds_sucursal,id_vendedor,ds_vendedor,id_articulo,ds_articulo,id_cliente,nombre_cliente,cantidades_total,subtotal_neto,subtotal_final,anulado,ds_documento')
      .gte('fecha_comprobante', d)
      .lte('fecha_comprobante', h)
      .not('id_articulo', 'is', null)
      .range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    all = all.concat(data as VentaRow[])
    if (data.length < PAGE) break
    from += PAGE
  }
  return all
}

async function fetchAgrupaciones(): Promise<Agrupacion[]> {
  const { data, error } = await supabase.from('chess_agrupaciones').select('*')
  if (error) throw new Error(error.message)
  return (data ?? []) as Agrupacion[]
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'resumen' | 'sucursal' | 'vendedor' | 'articulo' | 'division' | 'marca' | 'cliente' | 'devoluciones'

// ─── Componentes pequeños ─────────────────────────────────────────────────────

function KpiCard({ label, value, sub, subCls, note }: {
  label: string; value: string; sub?: string; subCls?: string; note?: string
}) {
  return (
    <div className="v2-kpi">
      <div className="v2-kpi-label">{label}</div>
      <div className="v2-kpi-value">{value}</div>
      {sub  && <div className={`v2-kpi-sub ${subCls ?? ''}`}>{sub}</div>}
      {note && <div className="v2-kpi-note">{note}</div>}
    </div>
  )
}

function BarRow({ nombre, meta, act, ant, max, rank }: {
  nombre: string; meta?: string; act: number; ant: number; max: number; rank?: number
}) {
  const vp = varPct(act, ant)
  return (
    <div className="v2-row">
      <div className="v2-row-left">
        {rank !== undefined && <span className="v2-rank">#{rank + 1}</span>}
        <div>
          <div className="v2-row-name">{nombre}</div>
          {meta && <div className="v2-row-meta">{meta}</div>}
        </div>
      </div>
      <div className="v2-row-right">
        <div className="v2-row-bars">
          <div className="v2-bar-track">
            <div className="v2-bar-act" style={{ width: `${max > 0 ? (Math.abs(act) / max) * 100 : 0}%` }} />
          </div>
          <div className="v2-bar-track ant">
            <div className="v2-bar-ant" style={{ width: `${max > 0 ? (Math.abs(ant) / max) * 100 : 0}%` }} />
          </div>
        </div>
        <div className="v2-row-nums">
          <span className="v2-num-act">{money(act)}</span>
          <span className="v2-num-ant">{money(ant)}</span>
          <span className={`v2-var ${vp.cls}`}>{vp.label}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function VentasPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const today        = toISO(new Date())
  const firstOfMonth = today.substring(0, 8) + '01'

  const [desde,    setDesde]    = useState(firstOfMonth)
  const [hasta,    setHasta]    = useState(today)
  const [sucursal, setSucursal] = useState('todas')
  const [tab,      setTab]      = useState<Tab>('resumen')

  const [actual,      setActual]      = useState<VentaRow[]>([])
  const [anterior,    setAnterior]    = useState<VentaRow[]>([])
  const [agrupaciones, setAgrupaciones] = useState<Map<number, Agrupacion>>(new Map())
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)

  const desdeAnt = useMemo(() => subtractMonth(desde, 1), [desde])
  const hastaAnt = useMemo(() => subtractMonth(hasta,  1), [hasta])
  const dias     = useMemo(() => daysBetween(desde, hasta) + 1, [desde, hasta])

  useEffect(() => {
    fetchAgrupaciones().then(rows => {
      const m = new Map<number, Agrupacion>()
      rows.forEach(r => m.set(r.codigo, r))
      setAgrupaciones(m)
    })
  }, [])

  useEffect(() => {
    if (!desde || !hasta || desde > hasta) return
    setLoading(true); setError(null)
    Promise.all([fetchAll(desde, hasta), fetchAll(desdeAnt, hastaAnt)])
      .then(([r1, r2]) => { setActual(r1); setAnterior(r2); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [desde, hasta, desdeAnt, hastaAnt])

  // Sucursales disponibles
  const sucursales = useMemo(() => {
    const m = new Map<number, string>()
    actual.forEach(r => m.set(r.id_sucursal, r.ds_sucursal))
    return Array.from(m.entries()).sort((a, b) => a[0] - b[0])
  }, [actual])

  function filterSuc(rows: VentaRow[]) {
    return sucursal === 'todas' ? rows : rows.filter(r => r.id_sucursal === Number(sucursal))
  }

  // Separar ventas y devoluciones
  const ventasAct = useMemo(() => filterSuc(actual).filter(r => !esDevolucion(r.ds_documento)), [actual, sucursal])
  const devuelAct = useMemo(() => filterSuc(actual).filter(r =>  esDevolucion(r.ds_documento)), [actual, sucursal])
  const ventasAnt = useMemo(() => filterSuc(anterior).filter(r => !esDevolucion(r.ds_documento)), [anterior, sucursal])
  const devuelAnt = useMemo(() => filterSuc(anterior).filter(r =>  esDevolucion(r.ds_documento)), [anterior, sucursal])

  // ─── KPIs globales ───────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalAct  = ventasAct.reduce((s, r) => s + r.subtotal_final, 0)
    const totalAnt  = ventasAnt.reduce((s, r) => s + r.subtotal_final, 0)
    const netoAct   = ventasAct.reduce((s, r) => s + r.subtotal_neto,  0)
    const unidAct   = ventasAct.reduce((s, r) => s + r.cantidades_total, 0)
    const unidAnt   = ventasAnt.reduce((s, r) => s + r.cantidades_total, 0)
    const clientAct = new Set(ventasAct.map(r => r.id_cliente)).size
    const clientAnt = new Set(ventasAnt.map(r => r.id_cliente)).size
    const artAct    = new Set(ventasAct.map(r => r.id_articulo)).size
    const devTotal  = devuelAct.reduce((s, r) => s + r.subtotal_final, 0)
    const devPct    = totalAct > 0 ? (Math.abs(devTotal) / totalAct) * 100 : 0
    const ticketAct = clientAct > 0 ? totalAct / clientAct : 0
    const ticketAnt = clientAnt > 0 ? totalAnt / clientAnt : 0
    return {
      totalAct, totalAnt, netoAct, unidAct, unidAnt,
      clientAct, clientAnt, artAct, devTotal, devPct,
      ticketAct, ticketAnt,
      varTotal:   varPct(totalAct, totalAnt),
      varUnid:    varPct(unidAct,  unidAnt),
      varClients: varPct(clientAct, clientAnt),
      varTicket:  varPct(ticketAct, ticketAnt),
    }
  }, [ventasAct, ventasAnt, devuelAct])

  // ─── Por sucursal ────────────────────────────────────────────────────────────
  const porSucursal = useMemo(() => {
    const m = new Map<number, any>()
    ventasAct.forEach(r => {
      if (!m.has(r.id_sucursal)) m.set(r.id_sucursal, { id: r.id_sucursal, nombre: r.ds_sucursal, act: 0, ant: 0, unid: 0, clients: new Set(), artMap: new Map() })
      const s = m.get(r.id_sucursal)
      s.act += r.subtotal_final; s.unid += r.cantidades_total; s.clients.add(r.id_cliente)
      s.artMap.set(r.ds_articulo, (s.artMap.get(r.ds_articulo) ?? 0) + r.cantidades_total)
    })
    ventasAnt.forEach(r => {
      if (!m.has(r.id_sucursal)) m.set(r.id_sucursal, { id: r.id_sucursal, nombre: r.ds_sucursal, act: 0, ant: 0, unid: 0, clients: new Set(), artMap: new Map() })
      m.get(r.id_sucursal).ant += r.subtotal_final
    })
    return Array.from(m.values()).map(s => ({
      ...s,
      clients: s.clients.size,
      topArt: Array.from(s.artMap.entries()).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] ?? '—',
    })).sort((a, b) => b.act - a.act)
  }, [ventasAct, ventasAnt])

  // ─── Por vendedor ────────────────────────────────────────────────────────────
  const porVendedor = useMemo(() => {
    const mA = new Map<string, any>(); const mB = new Map<string, number>()
    ventasAct.forEach(r => {
      const k = r.ds_vendedor || 'Sin asignar'
      if (!mA.has(k)) mA.set(k, { nombre: k, act: 0, unid: 0, clients: new Set() })
      const v = mA.get(k); v.act += r.subtotal_final; v.unid += r.cantidades_total; v.clients.add(r.id_cliente)
    })
    ventasAnt.forEach(r => { const k = r.ds_vendedor || 'Sin asignar'; mB.set(k, (mB.get(k) ?? 0) + r.subtotal_final) })
    return Array.from(mA.values()).map(v => ({
      ...v, clients: v.clients.size, ant: mB.get(v.nombre) ?? 0,
    })).sort((a, b) => b.act - a.act).slice(0, 20)
  }, [ventasAct, ventasAnt])

  // ─── Top artículos ───────────────────────────────────────────────────────────
  const topArticulos = useMemo(() => {
    const mA = new Map<number, any>(); const mB = new Map<number, number>()
    ventasAct.forEach(r => {
      if (!mA.has(r.id_articulo)) mA.set(r.id_articulo, { id: r.id_articulo, nombre: r.ds_articulo, act: 0, unid: 0 })
      const a = mA.get(r.id_articulo); a.act += r.subtotal_final; a.unid += r.cantidades_total
    })
    ventasAnt.forEach(r => mB.set(r.id_articulo, (mB.get(r.id_articulo) ?? 0) + r.subtotal_final))
    return Array.from(mA.values()).map(a => ({ ...a, ant: mB.get(a.id) ?? 0 }))
      .sort((a, b) => b.act - a.act).slice(0, 30)
  }, [ventasAct, ventasAnt])

  // ─── Por división ────────────────────────────────────────────────────────────
  const porDivision = useMemo(() => {
    const mA = new Map<string, any>(); const mB = new Map<string, number>()
    ventasAct.forEach(r => {
      const ag = agrupaciones.get(r.id_articulo)
      const k = ag?.division || 'Sin división'
      if (!mA.has(k)) mA.set(k, { nombre: k, act: 0, unid: 0 })
      const d = mA.get(k); d.act += r.subtotal_final; d.unid += r.cantidades_total
    })
    ventasAnt.forEach(r => {
      const ag = agrupaciones.get(r.id_articulo)
      const k = ag?.division || 'Sin división'
      mB.set(k, (mB.get(k) ?? 0) + r.subtotal_final)
    })
    return Array.from(mA.values()).map(d => ({ ...d, ant: mB.get(d.nombre) ?? 0 }))
      .sort((a, b) => b.act - a.act)
  }, [ventasAct, ventasAnt, agrupaciones])

  // ─── Por marca ───────────────────────────────────────────────────────────────
  const porMarca = useMemo(() => {
    const mA = new Map<string, any>(); const mB = new Map<string, number>()
    ventasAct.forEach(r => {
      const ag = agrupaciones.get(r.id_articulo)
      const k = ag?.marca || 'Sin marca'
      if (!mA.has(k)) mA.set(k, { nombre: k, act: 0, unid: 0 })
      const m = mA.get(k); m.act += r.subtotal_final; m.unid += r.cantidades_total
    })
    ventasAnt.forEach(r => {
      const ag = agrupaciones.get(r.id_articulo)
      const k = ag?.marca || 'Sin marca'
      mB.set(k, (mB.get(k) ?? 0) + r.subtotal_final)
    })
    return Array.from(mA.values()).map(m => ({ ...m, ant: mB.get(m.nombre) ?? 0 }))
      .sort((a, b) => b.act - a.act).slice(0, 25)
  }, [ventasAct, ventasAnt, agrupaciones])

  // ─── Top clientes ────────────────────────────────────────────────────────────
  const topClientes = useMemo(() => {
    const mA = new Map<number, any>(); const mB = new Map<number, number>()
    ventasAct.forEach(r => {
      if (!mA.has(r.id_cliente)) mA.set(r.id_cliente, { id: r.id_cliente, nombre: r.nombre_cliente, act: 0, unid: 0, arts: new Set() })
      const c = mA.get(r.id_cliente); c.act += r.subtotal_final; c.unid += r.cantidades_total; c.arts.add(r.id_articulo)
    })
    ventasAnt.forEach(r => mB.set(r.id_cliente, (mB.get(r.id_cliente) ?? 0) + r.subtotal_final))
    return Array.from(mA.values()).map(c => ({ ...c, arts: c.arts.size, ant: mB.get(c.id) ?? 0 }))
      .sort((a, b) => b.act - a.act).slice(0, 25)
  }, [ventasAct, ventasAnt])

  // ─── Devoluciones ────────────────────────────────────────────────────────────
  const devolucionesPorSuc = useMemo(() => {
    const mA = new Map<string, any>(); const mB = new Map<string, number>()
    const ventasTotalPorSuc = new Map<string, number>()
    devuelAct.forEach(r => {
      const k = r.ds_sucursal || 'Sin sucursal'
      if (!mA.has(k)) mA.set(k, { nombre: k, act: 0, cant: 0 })
      const d = mA.get(k); d.act += r.subtotal_final; d.cant++
    })
    devuelAnt.forEach(r => {
      const k = r.ds_sucursal || 'Sin sucursal'
      mB.set(k, (mB.get(k) ?? 0) + r.subtotal_final)
    })
    ventasAct.forEach(r => {
      const k = r.ds_sucursal || 'Sin sucursal'
      ventasTotalPorSuc.set(k, (ventasTotalPorSuc.get(k) ?? 0) + r.subtotal_final)
    })
    return Array.from(mA.values()).map(d => ({
      ...d,
      ant: mB.get(d.nombre) ?? 0,
      pctVentas: ventasTotalPorSuc.get(d.nombre)
        ? (Math.abs(d.act) / ventasTotalPorSuc.get(d.nombre)!) * 100
        : 0,
    })).sort((a, b) => Math.abs(b.act) - Math.abs(a.act))
  }, [devuelAct, devuelAnt, ventasAct])

  // ─── Render ───────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="v2-loading">
      <div className="v2-spinner" />
      <span>Cargando datos...</span>
    </div>
  )
  if (error) return (
    <div className="v2-loading">
      <span className="v2-error">Error: {error}</span>
    </div>
  )

  const maxSuc  = Math.max(...porSucursal.map(s => Math.max(s.act, s.ant)), 1)
  const maxVend = Math.max(...porVendedor.map(v => Math.max(v.act, v.ant)), 1)
  const maxArt  = Math.max(...topArticulos.map(a => Math.max(a.act, a.ant)), 1)
  const maxDiv  = Math.max(...porDivision.map(d => Math.max(d.act, d.ant)), 1)
  const maxMarca = Math.max(...porMarca.map(m => Math.max(m.act, m.ant)), 1)
  const maxCli  = Math.max(...topClientes.map(c => Math.max(c.act, c.ant)), 1)
  const maxDev  = Math.max(...devolucionesPorSuc.map(d => Math.abs(d.act)), 1)

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'resumen',      label: 'Resumen',      icon: '◈' },
    { id: 'sucursal',     label: 'Sucursales',   icon: '⊞' },
    { id: 'vendedor',     label: 'Vendedores',   icon: '◎' },
    { id: 'articulo',     label: 'Artículos',    icon: '⊡' },
    { id: 'division',     label: 'Divisiones',   icon: '◫' },
    { id: 'marca',        label: 'Marcas',       icon: '◉' },
    { id: 'cliente',      label: 'Clientes',     icon: '◷' },
    { id: 'devoluciones', label: 'Devoluciones', icon: '↩' },
  ]

  return (
    <>
      <style>{`
        :root {
          --bg: #f4f3ef;
          --surface: #ffffff;
          --border: #e2e0d9;
          --text: #1a1a18;
          --text-muted: #7a7870;
          --accent: #c8522a;
          --accent2: #2a6cc8;
          --green: #1e7a4a;
          --red: #c8222a;
          --font-head: 'Georgia', 'Times New Roman', serif;
          --font-body: 'Helvetica Neue', Arial, sans-serif;
          --font-mono: 'Courier New', monospace;
          --radius: 3px;
          --shadow: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04);
        }

        .v2-shell { min-height: 100vh; background: var(--bg); font-family: var(--font-body); }

        /* Topbar */
        .v2-topbar {
          background: var(--text);
          color: #fff;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 32px; height: 52px;
          position: sticky; top: 0; z-index: 100;
        }
        .v2-brand { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; }
        .v2-brand-icon { width: 28px; height: 28px; background: var(--accent); border-radius: 2px; display: grid; place-items: center; font-weight: 700; font-size: 14px; color: #fff; }
        .v2-brand-name { font-family: var(--font-head); font-size: 15px; letter-spacing: 0.02em; }
        .v2-nav { display: flex; gap: 4px; }
        .v2-nav-link { color: rgba(255,255,255,0.55); font-size: 13px; text-decoration: none; padding: 6px 12px; border-radius: 2px; transition: all 0.15s; }
        .v2-nav-link:hover { color: #fff; background: rgba(255,255,255,0.1); }
        .v2-nav-link.active { color: #fff; background: rgba(255,255,255,0.15); }
        .v2-topbar-right { display: flex; align-items: center; gap: 12px; }
        .v2-user { display: flex; align-items: center; gap: 8px; font-size: 13px; color: rgba(255,255,255,0.7); }
        .v2-avatar { width: 26px; height: 26px; background: var(--accent); border-radius: 50%; display: grid; place-items: center; font-size: 11px; font-weight: 700; color: #fff; }
        .v2-logout { background: transparent; border: 1px solid rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); font-size: 12px; padding: 4px 10px; border-radius: 2px; cursor: pointer; transition: all 0.15s; }
        .v2-logout:hover { border-color: rgba(255,255,255,0.5); color: #fff; }

        /* Layout */
        .v2-container { max-width: 1400px; margin: 0 auto; padding: 32px 32px 64px; }

        /* Header */
        .v2-page-header { margin-bottom: 28px; }
        .v2-breadcrumb { font-size: 11px; color: var(--text-muted); letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .v2-page-title { font-family: var(--font-head); font-size: 28px; font-weight: normal; color: var(--text); letter-spacing: -0.02em; }
        .v2-page-sub { font-size: 13px; color: var(--text-muted); margin-top: 4px; }

        /* Toolbar */
        .v2-toolbar {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 16px 20px;
          display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
          margin-bottom: 24px;
          box-shadow: var(--shadow);
        }
        .v2-field { display: flex; flex-direction: column; gap: 4px; }
        .v2-field-label { font-size: 10px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }
        .v2-field-input { border: 1px solid var(--border); border-radius: 2px; padding: 6px 10px; font-size: 13px; font-family: var(--font-body); color: var(--text); background: var(--bg); outline: none; transition: border-color 0.15s; }
        .v2-field-input:focus { border-color: var(--accent); }
        .v2-comp-badge { margin-left: auto; text-align: right; }
        .v2-comp-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-muted); }
        .v2-comp-val { font-size: 13px; font-weight: 600; color: var(--text); }
        .v2-comp-sub { font-size: 11px; color: var(--text-muted); }

        /* KPI row */
        .v2-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }
        .v2-kpi {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 20px;
          box-shadow: var(--shadow);
          position: relative;
          overflow: hidden;
        }
        .v2-kpi::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: var(--border); }
        .v2-kpi.accent::before { background: var(--accent); }
        .v2-kpi.green::before  { background: var(--green); }
        .v2-kpi.blue::before   { background: var(--accent2); }
        .v2-kpi-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 8px; }
        .v2-kpi-value { font-family: var(--font-head); font-size: 22px; color: var(--text); letter-spacing: -0.02em; }
        .v2-kpi-sub { font-size: 12px; margin-top: 6px; }
        .v2-kpi-sub.pos { color: var(--green); }
        .v2-kpi-sub.neg { color: var(--red); }
        .v2-kpi-sub.neutral { color: var(--text-muted); }
        .v2-kpi-note { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

        /* Tabs */
        .v2-tabs-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); }
        .v2-tabs { display: flex; border-bottom: 1px solid var(--border); overflow-x: auto; }
        .v2-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 13px 18px; font-size: 12px; font-weight: 500;
          color: var(--text-muted); border: none; background: transparent;
          cursor: pointer; white-space: nowrap;
          border-bottom: 2px solid transparent; margin-bottom: -1px;
          transition: all 0.15s;
        }
        .v2-tab:hover { color: var(--text); }
        .v2-tab.active { color: var(--accent); border-bottom-color: var(--accent); }
        .v2-tab-icon { font-size: 14px; }

        /* Panel */
        .v2-panel { padding: 24px; }

        /* Comp header */
        .v2-comp-header { display: flex; justify-content: flex-end; gap: 24px; padding: 0 0 12px; border-bottom: 1px solid var(--border); margin-bottom: 8px; }
        .v2-comp-col { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--text-muted); }
        .v2-dot { width: 8px; height: 8px; border-radius: 50%; }
        .v2-dot.act { background: var(--accent); }
        .v2-dot.ant { background: var(--border); border: 1px solid #ccc; }

        /* Rows */
        .v2-row { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--border); }
        .v2-row:last-child { border-bottom: none; }
        .v2-row-left { flex: 0 0 280px; display: flex; align-items: center; gap: 8px; min-width: 0; }
        .v2-rank { font-family: var(--font-mono); font-size: 11px; color: var(--text-muted); min-width: 28px; }
        .v2-row-name { font-size: 13px; font-weight: 500; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .v2-row-meta { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
        .v2-row-right { flex: 1; display: flex; align-items: center; gap: 16px; }
        .v2-row-bars { flex: 1; display: flex; flex-direction: column; gap: 3px; }
        .v2-bar-track { height: 5px; background: var(--bg); border-radius: 2px; overflow: hidden; }
        .v2-bar-track.ant { opacity: 0.5; }
        .v2-bar-act { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.4s cubic-bezier(.4,0,.2,1); }
        .v2-bar-ant { height: 100%; background: #bbb; border-radius: 2px; transition: width 0.4s cubic-bezier(.4,0,.2,1); }
        .v2-row-nums { display: flex; gap: 12px; align-items: center; flex: 0 0 340px; justify-content: flex-end; }
        .v2-num-act { font-size: 13px; font-weight: 600; color: var(--text); min-width: 110px; text-align: right; }
        .v2-num-ant { font-size: 12px; color: var(--text-muted); min-width: 110px; text-align: right; }
        .v2-var { font-size: 12px; font-weight: 600; min-width: 60px; text-align: right; }
        .v2-var.pos { color: var(--green); }
        .v2-var.neg { color: var(--red); }
        .v2-var.neutral { color: var(--text-muted); }

        /* Resumen grid */
        .v2-resumen-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .v2-resumen-card { background: var(--bg); border: 1px solid var(--border); border-radius: 2px; padding: 20px; }
        .v2-resumen-card-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 16px; font-weight: 600; }

        /* Dev badge */
        .v2-dev-badge { display: inline-flex; align-items: center; gap: 6px; background: #fff3f0; border: 1px solid #fca99a; color: var(--red); border-radius: 2px; padding: 3px 8px; font-size: 11px; font-weight: 600; }

        /* Pct bar */
        .v2-pct-bar-track { height: 6px; background: var(--bg); border-radius: 2px; overflow: hidden; margin-top: 6px; }
        .v2-pct-bar-fill { height: 100%; background: var(--red); border-radius: 2px; }

        /* Loading */
        .v2-loading { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: var(--bg); }
        .v2-spinner { width: 24px; height: 24px; border: 2px solid var(--border); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
        .v2-error { color: var(--red); font-size: 14px; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .v2-container { padding: 16px; }
          .v2-resumen-grid { grid-template-columns: 1fr; }
          .v2-row-left { flex: 0 0 160px; }
          .v2-row-nums { flex: 0 0 200px; }
          .v2-num-ant { display: none; }
        }
      `}</style>

      <div className="v2-shell">

        {/* Topbar */}
        <header className="v2-topbar">
          <Link to="/dashboard" className="v2-brand">
            <div className="v2-brand-icon">D</div>
            <span className="v2-brand-name">Dricka SAS</span>
          </Link>
          <nav className="v2-nav">
            <Link to="/dashboard" className="v2-nav-link">Inicio</Link>
            <Link to="/stock"     className="v2-nav-link">Stock</Link>
            <Link to="/ventas"    className="v2-nav-link active">Ventas</Link>
          </nav>
          <div className="v2-topbar-right">
            <div className="v2-user">
              <div className="v2-avatar">{(user?.username?.[0] ?? '?').toUpperCase()}</div>
              <span>{user?.username}</span>
            </div>
            <button className="v2-logout" onClick={() => { logout(); navigate('/login') }}>Salir</button>
          </div>
        </header>

        <div className="v2-container">

          {/* Header */}
          <div className="v2-page-header">
            <div className="v2-breadcrumb">Gestión / Ventas</div>
            <div className="v2-page-title">Análisis de ventas</div>
            <div className="v2-page-sub">
              Período actual vs. mismo período del mes anterior · {fmt(actual.length + anterior.length)} registros cargados
            </div>
          </div>

          {/* Toolbar */}
          <div className="v2-toolbar">
            <div className="v2-field">
              <label className="v2-field-label">Desde</label>
              <input type="date" className="v2-field-input" value={desde} onChange={e => setDesde(e.target.value)} />
            </div>
            <div className="v2-field">
              <label className="v2-field-label">Hasta</label>
              <input type="date" className="v2-field-input" value={hasta} onChange={e => setHasta(e.target.value)} max={today} />
            </div>
            <div className="v2-field">
              <label className="v2-field-label">Sucursal</label>
              <select className="v2-field-input" value={sucursal} onChange={e => setSucursal(e.target.value)}>
                <option value="todas">Todas las sucursales</option>
                {sucursales.map(([id, name]) => <option key={id} value={id}>{name || `Sucursal ${id}`}</option>)}
              </select>
            </div>
            <div className="v2-comp-badge">
              <div className="v2-comp-label">Comparando contra</div>
              <div className="v2-comp-val">{formatDate(desdeAnt)} – {formatDate(hastaAnt)}</div>
              <div className="v2-comp-sub">{dias} días · {dias} días</div>
            </div>
          </div>

          {/* KPIs */}
          <div className="v2-kpi-row">
            <KpiCard
              label="Total facturado"
              value={money(kpis.totalAct)}
              sub={`${kpis.varTotal.label} vs. ${money(kpis.totalAnt)}`}
              subCls={kpis.varTotal.cls}
            />
            <KpiCard
              label="Neto sin IVA"
              value={money(kpis.netoAct)}
              note={`IVA: ${money(kpis.totalAct - kpis.netoAct)}`}
            />
            <KpiCard
              label="Unidades vendidas"
              value={fmt(kpis.unidAct)}
              sub={`${kpis.varUnid.label} vs. ${fmt(kpis.unidAnt)}`}
              subCls={kpis.varUnid.cls}
            />
            <KpiCard
              label="Clientes únicos"
              value={fmt(kpis.clientAct)}
              sub={`${kpis.varClients.label} vs. ${fmt(kpis.clientAnt)}`}
              subCls={kpis.varClients.cls}
            />
            <KpiCard
              label="Ticket promedio"
              value={money(kpis.ticketAct)}
              sub={`${kpis.varTicket.label} vs. ${money(kpis.ticketAnt)}`}
              subCls={kpis.varTicket.cls}
            />
            <KpiCard
              label="Artículos distintos"
              value={fmt(kpis.artAct)}
              note="en el período"
            />
            <KpiCard
              label="Devoluciones"
              value={money(kpis.devTotal)}
              sub={`${kpis.devPct.toFixed(1)}% del total facturado`}
              subCls={kpis.devPct > 5 ? 'neg' : 'neutral'}
            />
          </div>

          {/* Tabs */}
          <div className="v2-tabs-wrap">
            <div className="v2-tabs">
              {TABS.map(t => (
                <button key={t.id} className={`v2-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                  <span className="v2-tab-icon">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="v2-panel">

              {/* Comp header */}
              {tab !== 'resumen' && (
                <div className="v2-comp-header">
                  <div className="v2-comp-col"><span className="v2-dot act" />{formatDate(desde)} – {formatDate(hasta)}</div>
                  <div className="v2-comp-col"><span className="v2-dot ant" />{formatDate(desdeAnt)} – {formatDate(hastaAnt)}</div>
                  <div className="v2-comp-col" style={{ minWidth: 60, justifyContent: 'flex-end' }}>Var.</div>
                </div>
              )}

              {/* RESUMEN */}
              {tab === 'resumen' && (
                <div className="v2-resumen-grid">
                  <div className="v2-resumen-card">
                    <div className="v2-resumen-card-title">Top 5 sucursales</div>
                    {porSucursal.slice(0, 5).map((s, i) => {
                      const vp = varPct(s.act, s.ant)
                      return (
                        <div key={s.id} className="v2-row">
                          <div className="v2-row-left">
                            <span className="v2-rank">#{i + 1}</span>
                            <div className="v2-row-name">{s.nombre || `Suc. ${s.id}`}</div>
                          </div>
                          <div className="v2-row-right">
                            <div className="v2-row-bars">
                              <div className="v2-bar-track"><div className="v2-bar-act" style={{ width: `${(s.act / maxSuc) * 100}%` }} /></div>
                            </div>
                            <div className="v2-row-nums">
                              <span className="v2-num-act">{money(s.act)}</span>
                              <span className={`v2-var ${vp.cls}`}>{vp.label}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="v2-resumen-card">
                    <div className="v2-resumen-card-title">Top 5 vendedores</div>
                    {porVendedor.slice(0, 5).map((v, i) => {
                      const vp = varPct(v.act, v.ant)
                      return (
                        <div key={v.nombre} className="v2-row">
                          <div className="v2-row-left">
                            <span className="v2-rank">#{i + 1}</span>
                            <div className="v2-row-name">{v.nombre}</div>
                          </div>
                          <div className="v2-row-right">
                            <div className="v2-row-bars">
                              <div className="v2-bar-track"><div className="v2-bar-act" style={{ width: `${(v.act / maxVend) * 100}%` }} /></div>
                            </div>
                            <div className="v2-row-nums">
                              <span className="v2-num-act">{money(v.act)}</span>
                              <span className={`v2-var ${vp.cls}`}>{vp.label}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="v2-resumen-card">
                    <div className="v2-resumen-card-title">Top 5 divisiones</div>
                    {porDivision.slice(0, 5).map((d, i) => {
                      const vp = varPct(d.act, d.ant)
                      return (
                        <div key={d.nombre} className="v2-row">
                          <div className="v2-row-left">
                            <span className="v2-rank">#{i + 1}</span>
                            <div className="v2-row-name">{d.nombre}</div>
                          </div>
                          <div className="v2-row-right">
                            <div className="v2-row-bars">
                              <div className="v2-bar-track"><div className="v2-bar-act" style={{ width: `${(d.act / maxDiv) * 100}%` }} /></div>
                            </div>
                            <div className="v2-row-nums">
                              <span className="v2-num-act">{money(d.act)}</span>
                              <span className={`v2-var ${vp.cls}`}>{vp.label}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="v2-resumen-card">
                    <div className="v2-resumen-card-title">Top 5 artículos</div>
                    {topArticulos.slice(0, 5).map((a, i) => {
                      const vp = varPct(a.act, a.ant)
                      return (
                        <div key={a.id} className="v2-row">
                          <div className="v2-row-left">
                            <span className="v2-rank">#{i + 1}</span>
                            <div className="v2-row-name">{a.nombre || `Art. ${a.id}`}</div>
                          </div>
                          <div className="v2-row-right">
                            <div className="v2-row-bars">
                              <div className="v2-bar-track"><div className="v2-bar-act" style={{ width: `${(a.act / maxArt) * 100}%` }} /></div>
                            </div>
                            <div className="v2-row-nums">
                              <span className="v2-num-act">{money(a.act)}</span>
                              <span className={`v2-var ${vp.cls}`}>{vp.label}</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* SUCURSALES */}
              {tab === 'sucursal' && porSucursal.map((s, i) => (
                <BarRow key={s.id} rank={i}
                  nombre={s.nombre || `Sucursal ${s.id}`}
                  meta={`${fmt(s.unid)} unidades · ${fmt(s.clients)} clientes · Top: ${s.topArt}`}
                  act={s.act} ant={s.ant} max={maxSuc}
                />
              ))}

              {/* VENDEDORES */}
              {tab === 'vendedor' && porVendedor.map((v, i) => (
                <BarRow key={v.nombre} rank={i}
                  nombre={v.nombre}
                  meta={`${money(v.act / (v.clients || 1))} ticket prom · ${fmt(v.clients)} clientes · ${fmt(v.unid)} unidades`}
                  act={v.act} ant={v.ant} max={maxVend}
                />
              ))}

              {/* ARTÍCULOS */}
              {tab === 'articulo' && topArticulos.map((a, i) => {
                const ag = agrupaciones.get(a.id)
                return (
                  <BarRow key={a.id} rank={i}
                    nombre={a.nombre || `Art. ${a.id}`}
                    meta={`${fmt(a.unid)} unidades · ${ag?.division ?? ''} ${ag?.marca ? '· ' + ag.marca : ''} · cód. ${a.id}`}
                    act={a.act} ant={a.ant} max={maxArt}
                  />
                )
              })}

              {/* DIVISIONES */}
              {tab === 'division' && porDivision.map((d, i) => (
                <BarRow key={d.nombre} rank={i}
                  nombre={d.nombre}
                  meta={`${fmt(d.unid)} unidades`}
                  act={d.act} ant={d.ant} max={maxDiv}
                />
              ))}

              {/* MARCAS */}
              {tab === 'marca' && porMarca.map((m, i) => (
                <BarRow key={m.nombre} rank={i}
                  nombre={m.nombre}
                  meta={`${fmt(m.unid)} unidades`}
                  act={m.act} ant={m.ant} max={maxMarca}
                />
              ))}

              {/* CLIENTES */}
              {tab === 'cliente' && topClientes.map((c, i) => (
                <BarRow key={c.id} rank={i}
                  nombre={c.nombre || `Cliente ${c.id}`}
                  meta={`${money(c.act / 1)} · ${fmt(c.arts)} artículos distintos · ${fmt(c.unid)} unidades`}
                  act={c.act} ant={c.ant} max={maxCli}
                />
              ))}

              {/* DEVOLUCIONES */}
              {tab === 'devoluciones' && (
                <div>
                  <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                    <div style={{ background: '#fff3f0', border: '1px solid #fca99a', borderRadius: 3, padding: '16px 20px', flex: '0 0 auto' }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#c8222a', marginBottom: 6 }}>Total devuelto</div>
                      <div style={{ fontSize: 22, fontFamily: 'Georgia, serif', color: '#c8222a' }}>{money(kpis.devTotal)}</div>
                      <div style={{ fontSize: 11, color: '#c8222a', marginTop: 4 }}>{kpis.devPct.toFixed(2)}% del total facturado</div>
                    </div>
                    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 3, padding: '16px 20px', flex: '0 0 auto' }}>
                      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 6 }}>Comprobantes devueltos</div>
                      <div style={{ fontSize: 22, fontFamily: 'Georgia, serif', color: 'var(--text)' }}>{fmt(devuelAct.length)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>líneas en el período</div>
                    </div>
                  </div>

                  <div className="v2-comp-header">
                    <div className="v2-comp-col"><span className="v2-dot act" />{formatDate(desde)} – {formatDate(hasta)}</div>
                    <div className="v2-comp-col"><span className="v2-dot ant" />{formatDate(desdeAnt)} – {formatDate(hastaAnt)}</div>
                    <div className="v2-comp-col" style={{ minWidth: 60, justifyContent: 'flex-end' }}>% ventas</div>
                  </div>

                  {devolucionesPorSuc.map((d, i) => (
                    <div key={d.nombre} className="v2-row">
                      <div className="v2-row-left">
                        <span className="v2-rank">#{i + 1}</span>
                        <div>
                          <div className="v2-row-name">{d.nombre}</div>
                          <div className="v2-row-meta">{fmt(d.cant)} comprobantes</div>
                        </div>
                      </div>
                      <div className="v2-row-right">
                        <div className="v2-row-bars" style={{ flex: 1 }}>
                          <div className="v2-pct-bar-track">
                            <div className="v2-pct-bar-fill" style={{ width: `${Math.min(d.pctVentas, 100)}%` }} />
                          </div>
                        </div>
                        <div className="v2-row-nums">
                          <span className="v2-num-act" style={{ color: 'var(--red)' }}>{money(d.act)}</span>
                          <span className="v2-num-ant">{money(d.ant)}</span>
                          <span className="v2-var neg">{d.pctVentas.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          </div>

        </div>
      </div>
    </>
  )
}
