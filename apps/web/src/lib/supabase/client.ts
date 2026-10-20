import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function createMockClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      signInWithPassword: async () => ({ data: { user: null }, error: { message: 'Supabase not configured' } }),
      signUp: async () => ({ data: { user: null }, error: { message: 'Supabase not configured' } }),
      signOut: async () => ({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }
}

export function createClient() {
  if (process.env.NEXT_PUBLIC_AUTH_MODE === 'local') {
    return { auth: {
      signInWithPassword: async (credentials: { email: string; password: string }) => { 
        const r = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(credentials) }); 
        const d = await r.json(); 
        return { error: r.ok ? null : { message: d.error || 'Login failed' } } 
      },
      signUp: async (payload: any) => { 
        const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: payload.email, password: payload.password, ...payload.options?.data }) }); 
        const d = await r.json(); 
        return { error: r.ok ? null : { message: d.error || 'Registration failed' } } 
      },
    } } as any
  }
  
  if (!supabaseUrl || !supabaseAnonKey) {
    return createMockClient()
  }
  
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
