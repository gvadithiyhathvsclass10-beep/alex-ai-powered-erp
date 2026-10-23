import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { AuditLogService } from '@/lib/audit-log'
<<<<<<< HEAD
import {
  resolveClassroomContext,
  verifySubjectManagementAccess,
} from '@/lib/classroom-permissions'

export async function GET(
  _request: Request,
=======

export async function GET(
  request: Request,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
    const context = await resolveClassroomContext(user)
=======

>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    const { id } = await params

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
<<<<<<< HEAD
        subject: {
          select: {
            id: true,
            name: true,
            code: true,
            semesterId: true,
            institutionId: true,
            enrollments: {
              where: { isActive: true },
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    memberships: { select: { studentId: true } },
                  },
                },
              },
            },
          },
        },
        semester: { select: { id: true, name: true, number: true } },
        results: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                memberships: { select: { studentId: true } },
              },
            },
=======
        subject: { select: { id: true, name: true, code: true, semesterId: true } },
        semester: { select: { id: true, name: true, number: true } },
        results: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, memberships: { select: { studentId: true } } } },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
          },
        },
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

<<<<<<< HEAD
    if (!context.isTeacher) {
=======
    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No active membership' }, { status: 400 })
    }

    if (membership.role === 'STUDENT') {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      if (!assessment.isPublished) {
        return NextResponse.json({ error: 'Assessment not published' }, { status: 403 })
      }
      const enrollment = await prisma.subjectEnrollment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId, isActive: true },
      })
      if (!enrollment) {
        return NextResponse.json({ error: 'Not enrolled in this subject' }, { status: 403 })
      }
<<<<<<< HEAD
      assessment.results = assessment.results.filter(
        (r: { userId: string }) => r.userId === user.id
      )
    } else if (!context.isAdmin) {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId },
      })
      if (!assignment && assessment.createdBy !== user.id) {
=======
      assessment.results = assessment.results.filter((r: any) => r.userId === user.id)
    } else if (membership.role === 'LECTURER' || membership.role === 'ADMIN') {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId },
      })
      if (!assignment && membership.role !== 'ADMIN') {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
      }
    }

<<<<<<< HEAD
    const normalizedResults = assessment.results.map((r) => ({
      ...r,
      user: {
        id: r.user.id,
        firstName: r.user.firstName,
        lastName: r.user.lastName,
        email: r.user.email,
        studentId: r.user.memberships?.[0]?.studentId || null,
      },
    }))

    const enrolledStudents = context.isTeacher
      ? (assessment.subject.enrollments || []).map((e) => ({
          id: e.user.id,
          firstName: e.user.firstName,
          lastName: e.user.lastName,
          email: e.user.email,
          studentId: e.user.memberships?.[0]?.studentId || null,
        }))
      : []

    const resultByUser = new Map(normalizedResults.map((r) => [r.userId, r]))
    const roster = context.isTeacher
      ? enrolledStudents.map((student) => {
          const existing = resultByUser.get(student.id)
          return (
            existing || {
              id: `ungraded-${student.id}`,
              assessmentId: assessment.id,
              userId: student.id,
              marksObtained: 0,
              hasMarks: false,
              feedback: null,
              gradedBy: null,
              gradedAt: null,
              isPublished: false,
              user: student,
            }
          )
        })
      : normalizedResults

    return NextResponse.json({
      assessment: {
        ...assessment,
        subject: {
          id: assessment.subject.id,
          name: assessment.subject.name,
          code: assessment.subject.code,
          semesterId: assessment.subject.semesterId,
          institutionId: assessment.subject.institutionId,
        },
        results: normalizedResults,
        enrolledStudents,
        roster,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assessments] Get assessment error:', error)
=======
    return NextResponse.json({ assessment })
  } catch (error) {
    console.error('Get assessment error:', error)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    return NextResponse.json({ error: 'Failed to get assessment' }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
    const context = await resolveClassroomContext(user)

    if (!context.isTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      isPublished,
      results,
      name,
      type,
      maxMarks,
      weight,
      assessmentDate,
      description,
    } = body

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: true,
        results: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                memberships: { select: { studentId: true } },
              },
            },
          },
        },
=======

    const { id } = await params
    const body = await request.json()
    const { isPublished, results } = body

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: { 
        subject: true, 
        results: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, memberships: { select: { studentId: true } } } }
          }
        }
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

<<<<<<< HEAD
    if (!context.isAdmin) {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId },
      })
      if (!assignment && assessment.createdBy !== user.id) {
=======
    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
    })

    if (!membership || !['LECTURER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (membership.role === 'LECTURER') {
      const assignment = await prisma.lecturerAssignment.findFirst({
        where: { userId: user.id, subjectId: assessment.subjectId },
      })
      if (!assignment) {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        return NextResponse.json({ error: 'Not assigned to this subject' }, { status: 403 })
      }
    }

<<<<<<< HEAD
    const effectiveMaxMarks =
      maxMarks !== undefined ? Number(maxMarks) : assessment.maxMarks
    if (Number.isNaN(effectiveMaxMarks) || effectiveMaxMarks <= 0) {
      return NextResponse.json(
        { error: 'maxMarks must be greater than 0' },
        { status: 400 }
      )
    }

    if (results && Array.isArray(results)) {
      for (const result of results) {
        if (result.userId === undefined || result.marksObtained === undefined) continue
        const numMarks = Number(result.marksObtained)
        if (Number.isNaN(numMarks) || numMarks < 0 || numMarks > effectiveMaxMarks) {
          return NextResponse.json(
            {
              error: `Invalid marks for student ${result.userId}: must be between 0 and ${effectiveMaxMarks}`,
            },
            { status: 400 }
          )
        }
      }
    }

    const oldValues = {
      name: assessment.name,
      maxMarks: assessment.maxMarks,
      isPublished: assessment.isPublished,
      publishedAt: assessment.publishedAt,
      results: assessment.results.map((r) => ({
=======
    const oldValues: any = {
      isPublished: assessment.isPublished,
      publishedAt: assessment.publishedAt,
      results: assessment.results.map((r: any) => ({
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        userId: r.userId,
        marksObtained: r.marksObtained,
        feedback: r.feedback,
        isPublished: r.isPublished,
      })),
    }

<<<<<<< HEAD
    const updateData: Record<string, unknown> = {}
    if (name !== undefined && String(name).trim()) {
      updateData.name = String(name).trim()
    }
    if (type !== undefined && String(type).trim()) {
      updateData.type = String(type).trim()
    }
    if (maxMarks !== undefined) {
      updateData.maxMarks = effectiveMaxMarks
    }
    if (weight !== undefined && !Number.isNaN(Number(weight))) {
      updateData.weight = Number(weight)
    }
    if (assessmentDate !== undefined) {
      const parsedDate = new Date(assessmentDate)
      if (!Number.isNaN(parsedDate.getTime())) {
        updateData.assessmentDate = parsedDate
      }
    }
    if (description !== undefined) {
      updateData.description = description ? String(description).trim() : null
    }

=======
    const updateData: any = {}
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    if (typeof isPublished === 'boolean') {
      updateData.isPublished = isPublished
      if (isPublished && !assessment.isPublished) {
        updateData.publishedAt = new Date()
      } else if (!isPublished && assessment.isPublished) {
        updateData.publishedAt = null
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(updateData).length > 0) {
        await tx.assessment.update({
          where: { id },
          data: updateData,
        })
      }

      if (results && Array.isArray(results)) {
        for (const result of results) {
<<<<<<< HEAD
          const {
            userId,
            marksObtained,
            feedback,
            isPublished: resultPublished,
          } = result
          if (userId === undefined || marksObtained === undefined) continue
          const numMarks = Number(marksObtained)
          if (Number.isNaN(numMarks)) continue

          const publishFlag =
            resultPublished !== undefined
              ? Boolean(resultPublished)
              : typeof isPublished === 'boolean'
                ? isPublished
                : true
=======
          const { userId, marksObtained, feedback, isPublished: resultPublished } = result
          if (userId === undefined || marksObtained === undefined) continue

          if (marksObtained < 0 || marksObtained > assessment.maxMarks) {
            throw new Error(`Invalid marks for user ${userId}: must be between 0 and ${assessment.maxMarks}`)
          }
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

          await tx.assessmentResult.upsert({
            where: { assessmentId_userId: { assessmentId: id, userId } },
            update: {
<<<<<<< HEAD
              marksObtained: numMarks,
              feedback: feedback ? String(feedback) : null,
              gradedBy: user.id,
              gradedAt: new Date(),
              isPublished: publishFlag,
              publishedAt: publishFlag ? new Date() : null,
=======
              marksObtained,
              feedback,
              gradedBy: user.id,
              gradedAt: new Date(),
              isPublished: resultPublished ?? false,
              publishedAt: resultPublished ? new Date() : null,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
            },
            create: {
              assessmentId: id,
              userId,
<<<<<<< HEAD
              marksObtained: numMarks,
              feedback: feedback ? String(feedback) : null,
              gradedBy: user.id,
              gradedAt: new Date(),
              isPublished: publishFlag,
              publishedAt: publishFlag ? new Date() : null,
=======
              marksObtained,
              feedback,
              gradedBy: user.id,
              gradedAt: new Date(),
              isPublished: resultPublished ?? false,
              publishedAt: resultPublished ? new Date() : null,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
            },
          })
        }
      }
    })

    const updatedAssessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        subject: { select: { id: true, name: true, code: true } },
        results: {
<<<<<<< HEAD
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                memberships: { select: { studentId: true } },
              },
            },
          },
=======
          include: { user: { select: { id: true, firstName: true, lastName: true, memberships: { select: { studentId: true } } } } },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        },
      },
    })

    const newValues = {
      isPublished: updatedAssessment?.isPublished,
      publishedAt: updatedAssessment?.publishedAt,
<<<<<<< HEAD
      results: updatedAssessment?.results.map((r) => ({
=======
      results: updatedAssessment?.results.map((r: any) => ({
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        userId: r.userId,
        marksObtained: r.marksObtained,
        feedback: r.feedback,
        isPublished: r.isPublished,
      })),
    }

    await AuditLogService.log({
<<<<<<< HEAD
      institutionId: context.institutionId || assessment.subject.institutionId,
      userId: user.id,
      action:
        isPublished !== undefined && isPublished !== assessment.isPublished
          ? isPublished
            ? 'ASSESSMENT_PUBLISH'
            : 'ASSESSMENT_UNPUBLISH'
          : 'ASSESSMENT_UPDATE_RESULTS',
=======
      institutionId: membership.institutionId,
      userId: user.id,
      action: isPublished !== undefined && isPublished !== assessment.isPublished 
        ? (isPublished ? 'ASSESSMENT_PUBLISH' : 'ASSESSMENT_UNPUBLISH')
        : 'ASSESSMENT_UPDATE_RESULTS',
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      entityType: 'Assessment',
      entityId: id,
      oldValues,
      newValues,
    })

<<<<<<< HEAD
    return NextResponse.json({
      assessment: updatedAssessment
        ? {
            ...updatedAssessment,
            results: updatedAssessment.results.map((r) => ({
              ...r,
              user: {
                id: r.user.id,
                firstName: r.user.firstName,
                lastName: r.user.lastName,
                email: r.user.email,
                studentId: r.user.memberships?.[0]?.studentId || null,
              },
            })),
          }
        : null,
    })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assessments] Update assessment error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update assessment' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return PUT(request, context)
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const existing = await prisma.assessment.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    const access = await verifySubjectManagementAccess(user, existing.subjectId)
    if (!access.allowed && existing.createdBy !== user.id) {
      return NextResponse.json({ error: access.error }, { status: access.status })
    }

    await prisma.assessment.delete({ where: { id } })

    await AuditLogService.log({
      institutionId: access.context.institutionId,
      userId: user.id,
      action: 'ASSESSMENT_DELETE',
      entityType: 'Assessment',
      entityId: id,
      oldValues: {
        name: existing.name,
        subjectId: existing.subjectId,
      },
    })

    return NextResponse.json({ success: true, deletedId: id })
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('[Assessments] Delete assessment error:', error)
    return NextResponse.json({ error: 'Failed to delete assessment' }, { status: 500 })
=======
    return NextResponse.json({ assessment: updatedAssessment })
  } catch (error) {
    console.error('Update assessment error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to update assessment' }, { status: 500 })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }
}