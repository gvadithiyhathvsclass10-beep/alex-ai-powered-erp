import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/audit-log'

export async function GET() {
  try {
    const user = await requireAuth()

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

<<<<<<< HEAD
    const effectiveRole = membership?.role || user.role

    const whereClause: Record<string, unknown> = {}
    if (effectiveRole === 'LECTURER') {
=======
    if (!membership) {
      return NextResponse.json({ error: 'No active membership' }, { status: 400 })
    }

    const whereClause: any = {}
    if (membership.role === 'LECTURER') {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      const assignments = await prisma.lecturerAssignment.findMany({
        where: { userId: user.id },
        select: { subjectId: true },
      })
      whereClause.subjectId = { in: assignments.map(a => a.subjectId) }
<<<<<<< HEAD
    } else if (effectiveRole === 'STUDENT') {
=======
    } else if (membership.role === 'STUDENT') {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      whereClause.isPublished = true
      whereClause.subject = {
        enrollments: { some: { userId: user.id, isActive: true } },
      }
    }

    const assessments = await prisma.assessment.findMany({
      where: whereClause,
      include: {
        subject: { select: { id: true, name: true, code: true, semesterId: true } },
        semester: { select: { id: true, name: true, number: true } },
        _count: { select: { results: true } },
      },
      orderBy: { assessmentDate: 'desc' },
    })

    return NextResponse.json({ assessments })
  } catch (error) {
<<<<<<< HEAD
    console.error('[Assessments] Assessments list error:', error)
=======
    console.error('Assessments list error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to list assessments' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

<<<<<<< HEAD
    const effectiveRole = membership?.role || user.role

    if (!['LECTURER', 'ADMIN'].includes(effectiveRole)) {
=======
    if (!membership || !['LECTURER', 'ADMIN'].includes(membership.role)) {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { subjectId, name, type, maxMarks, weight, assessmentDate, description } = body

    if (!subjectId || !name || !type || !maxMarks || !assessmentDate) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

<<<<<<< HEAD
    const subject = await prisma.subject.findUnique({
      where: { id: subjectId },
      select: { id: true, semesterId: true, institutionId: true },
    })

    if (!subject) {
      return NextResponse.json({ error: 'Subject not found' }, { status: 404 })
    }

    if (effectiveRole === 'LECTURER') {
=======
    if (membership.role === 'LECTURER') {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId },
      })
      if (!assignment) {
        return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
      }
    }

    const assessment = await prisma.assessment.create({
      data: {
        subjectId,
<<<<<<< HEAD
        semesterId: body.semesterId || subject.semesterId,
        name,
        type,
        maxMarks: Number(maxMarks),
        weight: Number(weight) || 1.0,
=======
        semesterId: body.semesterId || (await prisma.subject.findUnique({ where: { id: subjectId }, select: { semesterId: true } }))?.semesterId || '',
        name,
        type,
        maxMarks,
        weight: weight || 1.0,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        assessmentDate: new Date(assessmentDate),
        description,
        createdBy: user.id,
        isPublished: false,
      },
<<<<<<< HEAD
      include: {
        subject: { select: { id: true, name: true, code: true } },
        _count: { select: { results: true } },
      },
    })

    const institutionId = membership?.institutionId || subject.institutionId
    if (institutionId) {
      await AuditLogService.log({
        institutionId,
        userId: user.id,
        action: 'ASSESSMENT_CREATE',
        entityType: 'Assessment',
        entityId: assessment.id,
        newValues: { subjectId, name, type, maxMarks, weight, assessmentDate, isPublished: false },
      }).catch(() => undefined)
    }

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('[Assessments] Create assessment error:', error)
=======
      include: { subject: { select: { id: true, name: true, code: true } } },
    })

    await AuditLogService.log({
      institutionId: membership.institutionId,
      userId: user.id,
      action: 'ASSESSMENT_CREATE',
      entityType: 'Assessment',
      entityId: assessment.id,
      newValues: { subjectId, name, type, maxMarks, weight, assessmentDate, isPublished: false },
    })

    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Create assessment error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to create assessment' }, { status: 500 })
  }
}
