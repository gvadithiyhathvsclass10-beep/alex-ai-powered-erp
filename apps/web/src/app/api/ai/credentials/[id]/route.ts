import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    const { id } = await params

    const credential = await prisma.aICredential.findUnique({
      where: { id },
    })

    if (!credential || credential.userId !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.aICredential.delete({
      where: { id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('AI credential delete error:', error)
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 })
  }
}