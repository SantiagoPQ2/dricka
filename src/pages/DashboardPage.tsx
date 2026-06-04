import { useAuth } from '../lib/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import '../styles/stock.css'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const formatDate = (d: string) => new Date(d).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/dashboard" className="topbar-brand">
          <div className="brand-icon">D</div>
          <span className="brand-name">Dricka SAS</span>
        </Link>
        <nav className="topbar-nav">
          <Link to="/dashboard" className="tnav-link active">Inicio</Link>
          <Link to="/stock"     className="tnav-link">Stock</Link>
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
          <div className="breadcrumb">Inicio</div>
          <div className="page-title">Bienvenido, {user?.username}</div>
          <div className="page-desc" style={{ marginTop: 4 }}>Sistema de gestión comercial · Dricka SAS</div>
        </div>

        <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <Link to="/stock" style={{ textDecoration: 'none' }}>
            <div className="kpi-card blue" style={{ cursor: 'pointer', padding: '24px' }}>
              <div className="kpi-label">Stock</div>
              <div className="kpi-value" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>Inventario valorizado</div>
              <div className="kpi-note" style={{ marginTop: 8 }}>Cobertura de días · filtros por depósito y división · precios finales →</div>
            </div>
          </Link>
          <Link to="/ventas" style={{ textDecoration: 'none' }}>
            <div className="kpi-card green" style={{ cursor: 'pointer', padding: '24px' }}>
              <div className="kpi-label">Ventas</div>
              <div className="kpi-value" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>Análisis por sucursal</div>
              <div className="kpi-note" style={{ marginTop: 8 }}>Facturación · ranking de vendedores · top artículos →</div>
            </div>
          </Link>
        </div>

        <div className="table-card" style={{ maxWidth: 480 }}>
          <div className="table-card-header"><span className="table-card-title">Datos de sesión</span></div>
          <table className="data-table">
            <tbody>
              <tr><td className="td-tag">Usuario</td><td style={{ fontWeight: 500 }}>{user?.username}</td></tr>
              <tr><td className="td-tag">Email</td><td>{user?.email}</td></tr>
              <tr><td className="td-tag">Rol</td><td>{user?.role}</td></tr>
              <tr><td className="td-tag">Miembro desde</td><td>{user?.created_at ? formatDate(user.created_at) : '—'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
