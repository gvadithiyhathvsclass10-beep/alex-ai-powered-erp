import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notifications'
import { AuditLogService } from '@/lib/audit-log'
<<<<<<< HEAD
import { resolveClassroomContext } from '@/lib/classroom-permissions'
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

const LOW_ATTENDANCE_THRESHOLD = 35

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
    const context = await resolveClassroomContext(user)

    if (!context.isTeacher) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    const body = await request.json()
    const { action, studentId, subjectId, threshold } = body

<<<<<<< HEAD
    const effectiveThreshold = Number(threshold) || LOW_ATTENDANCE_THRESHOLD
    const institutionId = context.institutionId || ''

    if (action === 'check_and_notify') {
      return checkAndNotifyLowAttendance(institutionId, effectiveThreshold)
    } else if (action === 'notify_student') {
      if (!studentId || !subjectId) {
        return NextResponse.json(
          { error: 'Student ID and Subject ID required' },
          { status: 400 }
        )
      }
      return notifyStudentLowAttendance(
        studentId,
        subjectId,
        effectiveThreshold,
        institutionId
      )
    } else if (action === 'get_low_attendance') {
      return getLowAttendanceStudents(institutionId, effectiveThreshold, subjectId)
=======
    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { institution: true },
    })

    if (!membership || !['LECTURER', 'ADMIN'].includes(membership.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const effectiveThreshold = threshold || LOW_ATTENDANCE_THRESHOLD

    if (action === 'check_and_notify') {
      return checkAndNotifyLowAttendance(membership.institutionId, effectiveThreshold)
    } else if (action === 'notify_student') {
      if (!studentId || !subjectId) {
        return NextResponse.json({ error: 'Student ID and Subject ID required' }, { status: 400 })
      }
      return notifyStudentLowAttendance(studentId, subjectId, effectiveThreshold, membership.institutionId)
    } else if (action === 'get_low_attendance') {
      return getLowAttendanceStudents(membership.institutionId, effectiveThreshold, subjectId)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
<<<<<<< HEAD
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    console.error('Attendance alerts error:', error)
    return NextResponse.json({ error: 'Failed to process alerts' }, { status: 500 })
  }
}

async function checkAndNotifyLowAttendance(institutionId: string, threshold: number) {
  const students = await getLowAttendanceStudentsInternal(institutionId, threshold)
  const results = []

  for (const student of students) {
    const result = await notifyStudentLowAttendance(
      student.userId,
      student.subjectId,
      threshold,
      institutionId
    )
<<<<<<< HEAD
    results.push({
      studentId: student.userId,
      subjectId: student.subjectId,
      ...(await result.json()),
    })
=======
    results.push({ studentId: student.userId, subjectId: student.subjectId, ...await result.json() })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  }

  return NextResponse.json({ checked: students.length, notifications: results })
}

<<<<<<< HEAD
async function getLowAttendanceStudents(
  institutionId: string,
  threshold: number,
  subjectId?: string | null
) {
  const students = await getLowAttendanceStudentsInternal(
    institutionId,
    threshold,
    subjectId
  )
=======
async function getLowAttendanceStudents(institutionId: string, threshold: number, subjectId?: string | null) {
  const students = await getLowAttendanceStudentsInternal(institutionId, threshold, subjectId)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  return NextResponse.json({ students, threshold })
}

async function getLowAttendanceStudentsInternal(
  institutionId: string,
  threshold: number,
  subjectId?: string | null
) {
<<<<<<< HEAD
  const enrollmentWhere: any = { isActive: true }
  if (subjectId) enrollmentWhere.subjectId = subjectId
  if (institutionId) {
    enrollmentWhere.subject = { institutionId }
  }

=======
  const whereClause: any = {
    institutionId,
    role: 'STUDENT',
    status: 'ACTIVE',
  }

  const memberships = await prisma.collegeMembership.findMany({
    where: whereClause,
    include: { user: true },
  })

  const studentIds = memberships.map(m => m.userId)

  const enrollmentWhere: any = {
    userId: { in: studentIds },
    isActive: true,
  }
  if (subjectId) enrollmentWhere.subjectId = subjectId

>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  const enrollments = await prisma.subjectEnrollment.findMany({
    where: enrollmentWhere,
    include: {
      subject: {
        include: {
          attendanceSessions: {
<<<<<<< HEAD
            include: { records: true },
=======
            include: {
              records: { where: { userId: { in: studentIds } } },
            },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
            where: { isCancelled: false },
          },
        },
      },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  const lowAttendanceStudents: any[] = []

  for (const enrollment of enrollments) {
    const sessions = enrollment.subject.attendanceSessions
    if (sessions.length === 0) continue

    let present = 0
<<<<<<< HEAD
    let excused = 0

    sessions.forEach((session) => {
      const record = session.records.find((r) => r.userId === enrollment.userId)
      if (!record) return
      if (
        record.status === 'PRESENT' ||
        record.status === 'LATE' ||
        record.status === 'ON_DUTY'
      ) {
        present++
      } else if (record.status === 'EXCUSED') {
        excused++
      }
    })

    const total = Math.max(0, sessions.length - excused)
=======
    let total = sessions.length

    sessions.forEach(session => {
      const record = session.records.find(r => r.userId === enrollment.userId)
      if (record && (record.status === 'PRESENT' || record.status === 'LATE')) {
        present++
      }
    })

>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    const percentage = total > 0 ? Math.round((present / total) * 100) : 100

    if (percentage < threshold) {
      lowAttendanceStudents.push({
        userId: enrollment.userId,
        studentName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
        studentEmail: enrollment.user.email,
        subjectId: enrollment.subject.id,
        subjectName: enrollment.subject.name,
        subjectCode: enrollment.subject.code,
        present,
<<<<<<< HEAD
        total: sessions.length,
=======
        total,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        percentage,
      })
    }
  }

  return lowAttendanceStudents
}

async function notifyStudentLowAttendance(
  studentId: string,
  subjectId: string,
  threshold: number,
  institutionId: string
) {
  const enrollment = await prisma.subjectEnrollment.findUnique({
    where: { userId_subjectId: { userId: studentId, subjectId } },
    include: {
      subject: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 })
  }

  const sessions = await prisma.attendanceSession.findMany({
    where: { subjectId, isCancelled: false },
    include: { records: { where: { userId: studentId } } },
  })

  let present = 0
<<<<<<< HEAD
  let excused = 0
  sessions.forEach((session) => {
    const record = session.records[0]
    if (!record) return
    if (
      record.status === 'PRESENT' ||
      record.status === 'LATE' ||
      record.status === 'ON_DUTY'
    ) {
      present++
    } else if (record.status === 'EXCUSED') {
      excused++
    }
  })

  const total = Math.max(0, sessions.length - excused)
=======
  sessions.forEach(session => {
    const record = session.records[0]
    if (record && (record.status === 'PRESENT' || record.status === 'LATE')) present++
  })

  const total = sessions.length
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  const percentage = total > 0 ? Math.round((present / total) * 100) : 100

  if (percentage >= threshold) {
    return NextResponse.json({ error: 'Attendance above threshold' }, { status: 400 })
  }

  const existingNotification = await prisma.notification.findFirst({
    where: {
      userId: studentId,
      category: 'ATTENDANCE',
      referenceId: subjectId,
      referenceType: 'ATTENDANCE_ALERT',
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    },
  })

  if (existingNotification) {
    return NextResponse.json({ skipped: true, reason: 'Already notified recently' })
  }

  const notification = await prisma.notification.create({
    data: {
      userId: studentId,
      category: 'ATTENDANCE',
      title: `Low Attendance Alert: ${enrollment.subject.code}`,
      message: `Your attendance in ${enrollment.subject.name} (${enrollment.subject.code}) is ${percentage}%, which is below the ${threshold}% threshold. Please attend classes regularly to avoid academic consequences.`,
      referenceId: subjectId,
      referenceType: 'ATTENDANCE_ALERT',
<<<<<<< HEAD
      metadata: {
        percentage,
        threshold,
        present,
        total: sessions.length,
        subjectCode: enrollment.subject.code,
      },
    },
  })

  const resolvedInstId = institutionId || enrollment.subject.institutionId

  const guardianContacts = resolvedInstId
    ? await prisma.guardianContact.findMany({
        where: {
          institutionId: resolvedInstId,
          studentId,
          consentGiven: true,
        },
      })
    : []

  const notificationConfigs = resolvedInstId
    ? await prisma.notificationConfig.findMany({
        where: { institutionId: resolvedInstId, isActive: true },
      })
    : []
=======
      metadata: { percentage, threshold, present, total, subjectCode: enrollment.subject.code },
    },
  })

  const guardianContacts = await prisma.guardianContact.findMany({
    where: {
      institutionId,
      studentId,
      consentGiven: true,
    },
  })

  const notificationConfigs = await prisma.notificationConfig.findMany({
    where: { institutionId, isActive: true },
  })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

  const deliveryResults = []

  for (const guardian of guardianContacts) {
    for (const config of notificationConfigs) {
      try {
        const providerConfig = (config.providerConfig as Record<string, any>) || {}
        const result = await NotificationService.send({
          provider: config.provider,
          config: providerConfig,
          recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
          subject: `Attendance Alert: ${enrollment.subject.code}`,
          message: `Dear Guardian,\n\nYour ward ${enrollment.user.firstName} ${enrollment.user.lastName} has low attendance (${percentage}%) in ${enrollment.subject.name} (${enrollment.subject.code}). The minimum required is ${threshold}%.\n\nPlease encourage regular class attendance.\n\nRegards,\nALEX Academic System`,
        })

        await prisma.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            provider: config.provider,
<<<<<<< HEAD
            recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
=======
recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
            status: result.success ? 'DELIVERED' : 'FAILED',
            providerResponse: result.response,
            errorMessage: result.error,
            sentAt: new Date(),
            deliveredAt: result.success ? new Date() : null,
          },
        })

        deliveryResults.push({
          guardianId: guardian.id,
          provider: config.provider,
          status: result.success ? 'DELIVERED' : 'FAILED',
        })
      } catch (error) {
        deliveryResults.push({
          guardianId: guardian.id,
          provider: config.provider,
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }
  }

  await AuditLogService.log({
<<<<<<< HEAD
    institutionId: resolvedInstId,
=======
    institutionId,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    userId: studentId,
    action: 'LOW_ATTENDANCE_ALERT_SENT',
    entityType: 'Notification',
    entityId: notification.id,
<<<<<<< HEAD
    newValues: {
      percentage,
      threshold,
      subjectId,
      guardianNotifications: deliveryResults.length,
    },
=======
    newValues: { percentage, threshold, subjectId, guardianNotifications: deliveryResults.length },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  })

  return NextResponse.json({
    notified: true,
    studentId,
    subjectId,
    percentage,
    threshold,
    inAppNotification: notification.id,
    guardianDeliveries: deliveryResults,
  })
}
