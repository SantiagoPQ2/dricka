import { useAuth } from '../lib/AuthContext'
import { useNavigate } from 'react-router-dom'
import '../styles/dashboard.css'

export function DashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      year: 'numeric', month: 'long', day: 'numeric'
    })
  }

  return (
    <div className="dash-root">
      <div className="dash-bg">
        <div className="grid-overlay" />
      </div>

      <header className="dash-header">
        <div className="dash-logo">
          <span className="logo-bracket">[</span>
          <span className="logo-text">APP</span>
          <span className="logo-bracket">]</span>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          SALIR <span>→</span>
        </button>
      </header>

      <main className="dash-main">
        <div className="welcome-banner">
          <div className="welcome-tag">SESIÓN ACTIVA</div>
          <h1 className="welcome-title">
            Hola, <em>{user?.username ?? user?.email}</em>
          </h1>
          <p className="welcome-sub">Tu sesión está autenticada correctamente.</p>
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

        <div className="dash-note">
          <span className="note-icon">◈</span>
          <p>Este es un dashboard de ejemplo. Podés extender esta página con el contenido que necesites.</p>
        </div>
      </main>
    </div>
  )
}
