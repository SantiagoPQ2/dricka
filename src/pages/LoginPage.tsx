import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import '../styles/login.css'

export function LoginPage() {
  const { login, user } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  if (user) {
    navigate('/dashboard', { replace: true })
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await login(email, password)
    setLoading(false)
    if (error) {
      setError(error)
    } else {
      navigate('/dashboard')
    }
  }

  return (
    <div className="login-root">
      <div className="login-bg">
        <div className="grid-overlay" />
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="logo-bracket">[</span>
            <span className="logo-text">APP</span>
            <span className="logo-bracket">]</span>
          </div>
          <h1 className="login-title">Bienvenido</h1>
          <p className="login-subtitle">Ingresá tus credenciales para continuar</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="field-group">
            <label className="field-label" htmlFor="email">EMAIL</label>
            <input
              id="email"
              className="field-input"
              type="email"
              placeholder="usuario@ejemplo.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="field-group">
            <label className="field-label" htmlFor="password">CONTRASEÑA</label>
            <input
              id="password"
              className="field-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="error-box">
              <span className="error-icon">⚠</span>
              {error}
            </div>
          )}

          <button className={`login-btn ${loading ? 'loading' : ''}`} type="submit" disabled={loading}>
            {loading ? (
              <span className="btn-spinner" />
            ) : (
              <>
                <span>INGRESAR</span>
                <span className="btn-arrow">→</span>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <span className="footer-note">Sistema protegido · Anon Auth via Supabase</span>
        </div>
      </div>
    </div>
  )
}
