import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await requireAuth()

<<<<<<< HEAD
    if (user.role === 'LECTURER' || user.role === 'ADMIN') {
      const whereClause =
        user.role === 'ADMIN'
          ? {}
          : {
              OR: [
                { createdBy: user.id },
                { subject: { lecturers: { some: { userId: user.id } } } },
              ],
            }

      const assessments = await prisma.assessment.findMany({
        where: whereClause,
        include: {
          subject: { select: { id: true, name: true, code: true } },
          results: { select: { id: true, userId: true, marksObtained: true, isPublished: true } },
          _count: { select: { results: true } },
        },
        orderBy: { assessmentDate: 'desc' },
      })

      return NextResponse.json({ assessments })
    }

=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    const enrollments = await prisma.subjectEnrollment.findMany({
      where: { userId: user.id, isActive: true },
      include: {
        subject: {
          include: {
            assessments: {
              where: { isPublished: true },
<<<<<<< HEAD
              include: {
                results: {
                  where: { userId: user.id, isPublished: true },
                  select: { id: true, userId: true, marksObtained: true, feedback: true, isPublished: true },
                },
                _count: { select: { results: true } },
              },
              orderBy: { assessmentDate: 'desc' },
=======
              include: { _count: { select: { results: true } } },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
            },
          },
        },
      },
    })

<<<<<<< HEAD
    const assessments = enrollments.flatMap(e =>
=======
    const assessments = enrollments.flatMap(e => 
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      e.subject.assessments.map(a => ({
        ...a,
        subject: { id: e.subject.id, name: e.subject.name, code: e.subject.code },
      }))
    )

    return NextResponse.json({ assessments })
  } catch (error) {
<<<<<<< HEAD
    console.error('[Assessments] My assessments list error:', error)
=======
    console.error('My assessments list error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to list assessments' }, { status: 500 })
  }
}
