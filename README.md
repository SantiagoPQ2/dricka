# Login App — React + TypeScript + Supabase

App de login simple con autenticación contra una tabla `users` en Supabase usando la **anon key**.

## Stack

- React 18 + TypeScript
- Vite
- React Router v6
- Supabase JS (anon key)
- Netlify (deploy)

---

## 1. Crear la tabla en Supabase

Ejecutá este SQL en el **SQL Editor** de tu proyecto Supabase:

```sql
-- Crear tabla de usuarios
CREATE TABLE public.users (
  id          BIGSERIAL PRIMARY KEY,
  username    TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'user',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Política: la anon key puede hacer SELECT (necesario para el login)
CREATE POLICY "anon_select" ON public.users
  FOR SELECT
  TO anon
  USING (true);

-- Insertar usuarios de prueba
INSERT INTO public.users (username, email, password, role) VALUES
  ('admin',   'admin@ejemplo.com',   'admin123',  'admin'),
  ('usuario', 'usuario@ejemplo.com', 'pass1234',  'user');
```

> ⚠️ **IMPORTANTE**: Este sistema guarda contraseñas en texto plano, diseñado para aprender/prototipar. Para producción real usá Supabase Auth con hash de contraseñas.

---

## 2. Configurar variables de entorno

Copiá `.env.example` a `.env`:

```bash
cp .env.example .env
```

Completá con tus datos de Supabase (Project Settings → API):

```
VITE_SUPABASE_URL=https://xxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

---

## 3. Correr localmente

```bash
npm install
npm run dev
```

Abrí [http://localhost:5173](http://localhost:5173)

---

## 4. Deploy en Netlify

### Via GitHub (recomendado):

1. Subí el repo a GitHub
2. En Netlify → **Add new site → Import from Git**
3. Seleccioná el repo
4. Build command: `npm run build`
5. Publish directory: `dist`
6. En **Environment Variables** agregá:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy

El archivo `netlify.toml` ya maneja el redirect para React Router.

---

## Estructura del proyecto

```
src/
  lib/
    supabase.ts        # Cliente Supabase
    AuthContext.tsx    # Contexto de autenticación
  components/
    ProtectedRoute.tsx # Rutas protegidas
  pages/
    LoginPage.tsx      # Página de login
    DashboardPage.tsx  # Dashboard post-login
  styles/
    login.css
    dashboard.css
  main.tsx
```

---

## Usuarios de prueba

| Email                  | Contraseña | Rol   |
|------------------------|------------|-------|
| admin@ejemplo.com      | admin123   | admin |
| usuario@ejemplo.com    | pass1234   | user  |
