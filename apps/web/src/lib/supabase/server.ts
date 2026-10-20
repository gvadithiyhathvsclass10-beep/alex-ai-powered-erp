import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getLocalUserId, isLocalAuth, LOCAL_AUTH_COOKIE } from '@/lib/local-auth'

export async function createServerClientSupabase() {
  const cookieStore = await cookies()
  if (isLocalAuth()) {
    const userId = getLocalUserId(cookieStore.get(LOCAL_AUTH_COOKIE)?.value)
    return { auth: {
      getUser: async () => ({ data: { user: userId ? await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true } }) : null } }),
      signOut: async () => { cookieStore.set({ name: LOCAL_AUTH_COOKIE, value: '', maxAge: 0, path: '/' }); return { error: null } },
      exchangeCodeForSession: async () => ({ error: new Error('Email confirmation is not used in local auth mode') }),
    } } as any
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {
            // The `delete` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  )
}
