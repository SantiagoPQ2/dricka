import { useAuth } from '../lib/AuthContext'
import { useNavigate, Link } from 'react-router-dom'
import '../styles/dashboard.css'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="dash-root">
      <div className="dash-bg"><div className="grid-overlay" /></div>

      <header className="dash-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '40px' }}>
          <div className="dash-logo">
            <span className="logo-bracket">[</span>
            <span className="logo-text">APP</span>
            <span className="logo-bracket">]</span>
          </div>
          <nav style={{ display: 'flex', gap: '4px' }}>
            <Link to="/dashboard" className="nav-link active" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--accent)', textDecoration: 'none', padding: '6px 14px', borderRadius: '2px', border: '1px solid rgba(232,255,71,0.3)', background: 'rgba(232,255,71,0.05)' }}>INICIO</Link>
            <Link to="/stock"     style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--text-muted)', textDecoration: 'none', padding: '6px 14px', borderRadius: '2px', border: '1px solid transparent', transition: 'all 0.2s' }}>STOCK</Link>
            <Link to="/ventas"    style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.15em', color: 'var(--text-muted)', textDecoration: 'none', padding: '6px 14px', borderRadius: '2px', border: '1px solid transparent', transition: 'all 0.2s' }}>VENTAS</Link>
          </nav>
        </div>
        <button className="logout-btn" onClick={handleLogout}>SALIR <span>→</span></button>
      </header>

      <main className="dash-main">
        <div className="welcome-banner">
          <div className="welcome-tag">SESIÓN ACTIVA</div>
          <h1 className="welcome-title">Hola, <em>{user?.username ?? user?.email}</em></h1>
          <p className="welcome-sub">Sistema de gestión comercial · Dricka SAS</p>
        </div>

        <div className="info-grid" style={{ marginBottom: '40px' }}>
          <Link to="/stock" style={{ textDecoration: 'none' }}>
            <div className="info-card" style={{ cursor: 'pointer', borderColor: 'rgba(232,255,71,0.2)', background: 'rgba(232,255,71,0.03)' }}>
              <span className="info-label">STOCK</span>
              <span className="info-value" style={{ color: 'var(--accent)', fontSize: '13px' }}>Inventario valorizado</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>Cobertura · días stock · precios →</span>
            </div>
          </Link>
          <Link to="/ventas" style={{ textDecoration: 'none' }}>
            <div className="info-card" style={{ cursor: 'pointer', borderColor: 'rgba(71,200,255,0.2)', background: 'rgba(71,200,255,0.03)' }}>
              <span className="info-label">VENTAS</span>
              <span className="info-value" style={{ color: 'var(--accent2)', fontSize: '13px' }}>Análisis por sucursal</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>Vendedores · top artículos →</span>
            </div>
          </Link>
        </div>

        <div className="info-grid">
          <div className="info-card">
            <span className="info-label">USUARIO</span>
            <span className="info-value">{user?.username}</span>
          </div>
          <div className="info-card">
            <span className="info-label">EMAIL</span>
            <span className="info-value">{user?.email}</span>
          </div>
          <div className="info-card">
            <span className="info-label">ROL</span>
            <span className="info-value role-badge">{user?.role}</span>
          </div>
          <div className="info-card">
            <span className="info-label">MIEMBRO DESDE</span>
            <span className="info-value">{user?.created_at ? formatDate(user.created_at) : '—'}</span>
          </div>
        </div>
      </main>
    </div>
  )
}
