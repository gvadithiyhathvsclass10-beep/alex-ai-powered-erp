import { createServerClientSupabase } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createServerClientSupabase()
  await supabase.auth.signOut()
  
  return NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_APP_URL))
}