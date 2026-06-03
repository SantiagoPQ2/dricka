import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export interface AppUser {
  id: number
  username: string
  email: string
  role: string
  created_at: string
}

interface AuthContextType {
  user: AppUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<{ error: string | null }>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restaurar sesión desde localStorage
    const stored = localStorage.getItem('app_user')
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem('app_user')
      }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('password', password)
      .single()

    if (error || !data) {
      return { error: 'Email o contraseña incorrectos.' }
    }

    const appUser: AppUser = data as AppUser
    setUser(appUser)
    localStorage.setItem('app_user', JSON.stringify(appUser))
    return { error: null }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('app_user')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
