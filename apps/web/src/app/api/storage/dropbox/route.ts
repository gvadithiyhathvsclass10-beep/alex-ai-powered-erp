import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()
    const connection = await prisma.dropboxConnection.findUnique({ where: { userId: user.id }, select: { accountEmail: true, accountName: true, rootPath: true, createdAt: true, updatedAt: true } })
    return NextResponse.json({ connected: Boolean(connection), connection })
  } catch { return NextResponse.json({ error: 'Failed to read Dropbox connection' }, { status: 500 }) }
}

export async function DELETE() {
  try {
    const user = await requireAuth()
    await prisma.dropboxConnection.deleteMany({ where: { userId: user.id } })
    return NextResponse.json({ ok: true })
  } catch { return NextResponse.json({ error: 'Failed to disconnect Dropbox' }, { status: 500 }) }
}
