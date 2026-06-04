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

  if (user) { navigate('/dashboard', { replace: true }); return null }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error } = await login(email, password)
    setLoading(false)
    if (error) setError(error)
    else navigate('/dashboard')
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-icon">D</div>
          <span className="login-logo-name">Dricka SAS</span>
        </div>

        <h1 className="login-title">Iniciar sesión</h1>
        <p className="login-sub">Ingresá tus credenciales para continuar</p>

        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          <div className="form-field">
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              className="form-input"
              type="email"
              placeholder="usuario@empresa.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="password">Contraseña</label>
            <input
              id="password"
              className="form-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  )
}
