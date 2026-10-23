import { requireAuth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { NotificationService } from '@/lib/notifications'
import { AuditLogService } from '@/lib/audit-log'
<<<<<<< HEAD
import { resolveClassroomContext } from '@/lib/classroom-permissions'
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

export async function GET(request: Request) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
    const context = await resolveClassroomContext(user)
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    const { searchParams } = new URL(request.url)
    const reportType = searchParams.get('type') || 'student'
    const period = searchParams.get('period') || 'midterm'
    const semesterId = searchParams.get('semesterId')

<<<<<<< HEAD
    if (reportType === 'student') {
      return generateStudentPeriodicReport(user.id, period, semesterId)
    } else if (reportType === 'guardian') {
      return generateGuardianPeriodicReport(
        user.id,
        period,
        semesterId,
        context.institutionId || ''
      )
    } else if (reportType === 'institution') {
      if (!context.isTeacher) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return generateInstitutionPeriodicReport(
        context.institutionId || '',
        period,
        semesterId
      )
=======
    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { institution: true },
    })

    if (!membership) {
      return NextResponse.json({ error: 'No active membership' }, { status: 400 })
    }

    if (reportType === 'student') {
      return generateStudentPeriodicReport(user.id, period, semesterId)
    } else if (reportType === 'guardian') {
      return generateGuardianPeriodicReport(user.id, period, semesterId, membership.institutionId)
    } else if (reportType === 'institution') {
      if (!['ADMIN', 'LECTURER'].includes(membership.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
      return generateInstitutionPeriodicReport(membership.institutionId, period, semesterId)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    }

    return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
  } catch (error) {
<<<<<<< HEAD
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    console.error('Periodic report error:', error)
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth()
<<<<<<< HEAD
    const context = await resolveClassroomContext(user)

    if (!context.isAdmin) {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    const body = await request.json()
    const { action, period, semesterId } = body

    if (action === 'generate_and_send') {
      return generateAndSendPeriodicReports(
        context.institutionId || '',
        period || 'midterm',
        semesterId || null
      )
=======

    const body = await request.json()
    const { action, institutionId, period, semesterId } = body

    const membership = await prisma.collegeMembership.findFirst({
      where: { userId: user.id, status: 'ACTIVE' },
      include: { institution: true },
    })

    if (!membership || membership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 })
    }

    if (action === 'generate_and_send') {
      return generateAndSendPeriodicReports(membership.institutionId, period, semesterId)
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
    console.error('Periodic report generation error:', error)
    return NextResponse.json({ error: 'Failed to generate reports' }, { status: 500 })
  }
}

<<<<<<< HEAD
async function generateStudentPeriodicReport(
  userId: string,
  period: string,
  semesterId: string | null
) {
  const enrollments = await prisma.subjectEnrollment.findMany({
    where: {
      userId,
      isActive: true,
      ...(semesterId ? { subject: { semesterId } } : {}),
    },
=======
async function generateStudentPeriodicReport(userId: string, period: string, semesterId: string | null) {
  const enrollments = await prisma.subjectEnrollment.findMany({
    where: { userId, isActive: true, ...(semesterId ? { subject: { semesterId } } : {}) },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    include: {
      subject: {
        include: {
          semester: true,
          attendanceSessions: {
            include: { records: { where: { userId } } },
            where: { isCancelled: false },
          },
          assessments: {
            where: { isPublished: true },
            include: { results: { where: { userId } } },
          },
        },
      },
    },
  })

<<<<<<< HEAD
  const subjects = enrollments.map((enrollment) => {
    const sessions = enrollment.subject.attendanceSessions
    let present = 0
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

    const effectiveTotal = Math.max(0, sessions.length - excused)

    const assessments = enrollment.subject.assessments.map((assessment) => {
=======
  const subjects = enrollments.map(enrollment => {
    const sessions = enrollment.subject.attendanceSessions
    let present = 0
    sessions.forEach(session => {
      const record = session.records[0]
      if (record && (record.status === 'PRESENT' || record.status === 'LATE')) present++
    })

    const assessments = enrollment.subject.assessments.map(assessment => {
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      const result = assessment.results[0]
      return {
        assessmentId: assessment.id,
        name: assessment.name,
        type: assessment.type,
        maxMarks: assessment.maxMarks,
        weight: assessment.weight,
        marksObtained: result?.marksObtained ?? null,
<<<<<<< HEAD
        percentage:
          result && assessment.maxMarks > 0
            ? Math.round((result.marksObtained / assessment.maxMarks) * 100)
            : null,
=======
        percentage: result && assessment.maxMarks > 0 ? Math.round((result.marksObtained / assessment.maxMarks) * 100) : null,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        isPublished: assessment.isPublished,
      }
    })

<<<<<<< HEAD
    const publishedAssessments = assessments.filter(
      (a) => a.isPublished && a.marksObtained !== null
    )
    const avgMarks =
      publishedAssessments.length > 0
        ? Math.round(
            publishedAssessments.reduce((sum, a) => sum + (a.percentage || 0), 0) /
              publishedAssessments.length
          )
        : null
=======
    const publishedAssessments = assessments.filter(a => a.isPublished && a.marksObtained !== null)
    const avgMarks = publishedAssessments.length > 0
      ? Math.round(publishedAssessments.reduce((sum, a) => sum + (a.percentage || 0), 0) / publishedAssessments.length)
      : null
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    return {
      subjectId: enrollment.subject.id,
      subjectName: enrollment.subject.name,
      subjectCode: enrollment.subject.code,
      semester: enrollment.subject.semester.name,
      attendance: {
        present,
        total: sessions.length,
<<<<<<< HEAD
        percentage:
          effectiveTotal > 0 ? Math.round((present / effectiveTotal) * 100) : 100,
=======
        percentage: sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 100,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      },
      assessments,
      averageMarks: avgMarks,
    }
  })

<<<<<<< HEAD
  const overallAttendance =
    subjects.length > 0
      ? Math.round(
          subjects.reduce((sum, s) => sum + s.attendance.percentage, 0) /
            subjects.length
        )
      : 100

  const overallMarks =
    subjects.filter((s) => s.averageMarks !== null).length > 0
      ? Math.round(
          subjects
            .filter((s) => s.averageMarks !== null)
            .reduce((sum, s) => sum + (s.averageMarks || 0), 0) /
            subjects.filter((s) => s.averageMarks !== null).length
        )
      : null
=======
  const overallAttendance = subjects.length > 0
    ? Math.round(subjects.reduce((sum, s) => sum + s.attendance.percentage, 0) / subjects.length)
    : 100

  const overallMarks = subjects.filter(s => s.averageMarks !== null).length > 0
    ? Math.round(subjects.filter(s => s.averageMarks !== null).reduce((sum, s) => sum + (s.averageMarks || 0), 0) / subjects.filter(s => s.averageMarks !== null).length)
    : null
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

  return NextResponse.json({
    period,
    generatedAt: new Date().toISOString(),
    subjects,
    summary: {
      overallAttendance,
      overallMarks,
      subjectsCount: subjects.length,
<<<<<<< HEAD
      lowAttendanceSubjects: subjects.filter((s) => s.attendance.percentage < 75)
        .length,
=======
      lowAttendanceSubjects: subjects.filter(s => s.attendance.percentage < 75).length,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    },
  })
}

<<<<<<< HEAD
async function generateGuardianPeriodicReport(
  _userId: string,
  period: string,
  semesterId: string | null,
  institutionId: string
) {
  const guardianContacts = await prisma.guardianContact.findMany({
    where: {
      ...(institutionId ? { institutionId } : {}),
      consentGiven: true,
    },
    include: {
      student: {
        include: {
          memberships: {
            where: { status: 'ACTIVE' },
            include: { institution: true },
          },
        },
      },
    },
  })

  const uniqueStudentIds = [...new Set(guardianContacts.map((gc) => gc.studentId))]
  const reports = []

  for (const studentId of uniqueStudentIds) {
    const studentReport = await generateStudentPeriodicReport(
      studentId,
      period,
      semesterId
    )
    const studentData = await studentReport.json()

    const guardians = guardianContacts.filter((gc) => gc.studentId === studentId)
    reports.push({
      studentId,
      guardians: guardians.map((g) => ({
        id: g.id,
        name: g.name,
        relationship: g.relationship,
        email: g.email,
        phone: g.phone,
      })),
=======
async function generateGuardianPeriodicReport(userId: string, period: string, semesterId: string | null, institutionId: string) {
  const guardianContacts = await prisma.guardianContact.findMany({
    where: { institutionId, consentGiven: true },
    include: { student: { include: { memberships: { where: { status: 'ACTIVE' }, include: { institution: true } } } } },
  })

  const studentIds = guardianContacts.map(gc => gc.studentId)
  const uniqueStudentIds = [...new Set(studentIds)]

  const reports = []

  for (const studentId of uniqueStudentIds) {
    const studentReport = await generateStudentPeriodicReport(studentId, period, semesterId)
    const studentData = await studentReport.json()

    const guardians = guardianContacts.filter(gc => gc.studentId === studentId)
    reports.push({
      studentId,
      guardians: guardians.map(g => ({ id: g.id, name: g.name, relationship: g.relationship, email: g.email, phone: g.phone })),
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      report: studentData,
    })
  }

<<<<<<< HEAD
  return NextResponse.json({
    period,
    generatedAt: new Date().toISOString(),
    reports,
  })
}

async function generateInstitutionPeriodicReport(
  _institutionId: string,
  period: string,
  semesterId: string | null
) {
  const enrollments = await prisma.subjectEnrollment.findMany({
    where: {
      isActive: true,
      ...(semesterId ? { subject: { semesterId } } : {}),
    },
=======
  return NextResponse.json({ period, generatedAt: new Date().toISOString(), reports })
}

async function generateInstitutionPeriodicReport(institutionId: string, period: string, semesterId: string | null) {
  const enrollments = await prisma.subjectEnrollment.findMany({
    where: { isActive: true, ...(semesterId ? { subject: { semesterId } } : {}) },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    include: {
      subject: {
        include: {
          semester: true,
          attendanceSessions: {
            include: { records: true },
            where: { isCancelled: false },
          },
          assessments: {
            where: { isPublished: true },
            include: { results: true },
          },
        },
      },
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  const studentReports = new Map<string, any>()

  for (const enrollment of enrollments) {
    const studentId = enrollment.userId
    if (!studentReports.has(studentId)) {
      studentReports.set(studentId, {
        studentId,
        studentName: `${enrollment.user.firstName} ${enrollment.user.lastName}`,
        studentEmail: enrollment.user.email,
        subjects: [],
      })
    }

    const sessions = enrollment.subject.attendanceSessions
    let present = 0
<<<<<<< HEAD
    let excused = 0
    sessions.forEach((session) => {
      const record = session.records.find((r) => r.userId === studentId)
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

    const effectiveTotal = Math.max(0, sessions.length - excused)

    const assessments = enrollment.subject.assessments.map((assessment) => {
      const result = assessment.results.find((r) => r.userId === studentId)
=======
    sessions.forEach(session => {
      const record = session.records.find(r => r.userId === studentId)
      if (record && (record.status === 'PRESENT' || record.status === 'LATE')) present++
    })

    const assessments = enrollment.subject.assessments.map(assessment => {
      const result = assessment.results.find(r => r.userId === studentId)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      return {
        assessmentId: assessment.id,
        name: assessment.name,
        type: assessment.type,
        maxMarks: assessment.maxMarks,
        marksObtained: result?.marksObtained ?? null,
<<<<<<< HEAD
        percentage:
          result && assessment.maxMarks > 0
            ? Math.round((result.marksObtained / assessment.maxMarks) * 100)
            : null,
      }
    })

    const publishedAssessments = assessments.filter((a) => a.marksObtained !== null)
    const avgMarks =
      publishedAssessments.length > 0
        ? Math.round(
            publishedAssessments.reduce((sum, a) => sum + (a.percentage || 0), 0) /
              publishedAssessments.length
          )
        : null
=======
        percentage: result && assessment.maxMarks > 0 ? Math.round((result.marksObtained / assessment.maxMarks) * 100) : null,
      }
    })

    const publishedAssessments = assessments.filter(a => a.marksObtained !== null)
    const avgMarks = publishedAssessments.length > 0
      ? Math.round(publishedAssessments.reduce((sum, a) => sum + (a.percentage || 0), 0) / publishedAssessments.length)
      : null
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    studentReports.get(studentId).subjects.push({
      subjectId: enrollment.subject.id,
      subjectName: enrollment.subject.name,
      subjectCode: enrollment.subject.code,
      attendance: {
        present,
        total: sessions.length,
<<<<<<< HEAD
        percentage:
          effectiveTotal > 0 ? Math.round((present / effectiveTotal) * 100) : 100,
=======
        percentage: sessions.length > 0 ? Math.round((present / sessions.length) * 100) : 100,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
      },
      assessments,
      averageMarks: avgMarks,
    })
  }

<<<<<<< HEAD
  const allReports = Array.from(studentReports.values()).map((report) => {
    const overallAttendance =
      report.subjects.length > 0
        ? Math.round(
            report.subjects.reduce(
              (sum: number, s: any) => sum + s.attendance.percentage,
              0
            ) / report.subjects.length
          )
        : 100
    const overallMarks =
      report.subjects.filter((s: any) => s.averageMarks !== null).length > 0
        ? Math.round(
            report.subjects
              .filter((s: any) => s.averageMarks !== null)
              .reduce((sum: number, s: any) => sum + (s.averageMarks || 0), 0) /
              report.subjects.filter((s: any) => s.averageMarks !== null).length
          )
        : null
=======
  const allReports = Array.from(studentReports.values()).map(report => {
    const overallAttendance = report.subjects.length > 0
      ? Math.round(report.subjects.reduce((sum: number, s: any) => sum + s.attendance.percentage, 0) / report.subjects.length)
      : 100
    const overallMarks = report.subjects.filter((s: any) => s.averageMarks !== null).length > 0
      ? Math.round(report.subjects.filter((s: any) => s.averageMarks !== null).reduce((sum: number, s: any) => sum + (s.averageMarks || 0), 0) / report.subjects.filter((s: any) => s.averageMarks !== null).length)
      : null
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    return { ...report, overallAttendance, overallMarks }
  })

  return NextResponse.json({
    period,
    semesterId,
    generatedAt: new Date().toISOString(),
    totalStudents: allReports.length,
    reports: allReports,
    summary: {
<<<<<<< HEAD
      avgAttendance:
        allReports.length > 0
          ? Math.round(
              allReports.reduce((sum, r) => sum + r.overallAttendance, 0) /
                allReports.length
            )
          : 0,
      avgMarks:
        allReports.filter((r) => r.overallMarks !== null).length > 0
          ? Math.round(
              allReports
                .filter((r) => r.overallMarks !== null)
                .reduce((sum, r) => sum + (r.overallMarks || 0), 0) /
                allReports.filter((r) => r.overallMarks !== null).length
            )
          : null,
      atRiskStudents: allReports.filter(
        (r) =>
          r.overallAttendance < 75 ||
          (r.overallMarks !== null && r.overallMarks < 40)
      ).length,
=======
      avgAttendance: allReports.length > 0 ? Math.round(allReports.reduce((sum, r) => sum + r.overallAttendance, 0) / allReports.length) : 0,
      avgMarks: allReports.filter(r => r.overallMarks !== null).length > 0
        ? Math.round(allReports.filter(r => r.overallMarks !== null).reduce((sum, r) => sum + (r.overallMarks || 0), 0) / allReports.filter(r => r.overallMarks !== null).length)
        : null,
      atRiskStudents: allReports.filter(r => r.overallAttendance < 75 || (r.overallMarks !== null && r.overallMarks < 40)).length,
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    },
  })
}

<<<<<<< HEAD
async function generateAndSendPeriodicReports(
  institutionId: string,
  period: string,
  semesterId: string | null
) {
  const guardianContacts = await prisma.guardianContact.findMany({
    where: {
      ...(institutionId ? { institutionId } : {}),
      consentGiven: true,
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  })

  const studentIds = [...new Set(guardianContacts.map((gc) => gc.studentId))]
  const notificationConfigs = await prisma.notificationConfig.findMany({
    where: {
      ...(institutionId ? { institutionId } : {}),
      isActive: true,
    },
=======
async function generateAndSendPeriodicReports(institutionId: string, period: string, semesterId: string | null) {
  const guardianContacts = await prisma.guardianContact.findMany({
    where: { institutionId, consentGiven: true },
    include: { student: { select: { id: true, firstName: true, lastName: true, email: true } } },
  })

  const studentIds = [...new Set(guardianContacts.map(gc => gc.studentId))]
  const notificationConfigs = await prisma.notificationConfig.findMany({
    where: { institutionId, isActive: true },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  })

  const results = []

  for (const studentId of studentIds) {
<<<<<<< HEAD
    const studentReport = await generateStudentPeriodicReport(
      studentId,
      period,
      semesterId
    )
    const reportData = await studentReport.json()

    const studentGuardians = guardianContacts.filter(
      (gc) => gc.studentId === studentId
    )
=======
    const studentReport = await generateStudentPeriodicReport(studentId, period, semesterId)
    const reportData = await studentReport.json()

    const studentGuardians = guardianContacts.filter(gc => gc.studentId === studentId)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

    for (const guardian of studentGuardians) {
      for (const config of notificationConfigs) {
        try {
          const subject = `${period.charAt(0).toUpperCase() + period.slice(1)} Report: ${guardian.student.firstName} ${guardian.student.lastName}`
          const message = formatReportMessage(guardian.student, reportData, period)

          const providerConfig = (config.providerConfig as Record<string, any>) || {}
          const result = await NotificationService.send({
            provider: config.provider,
            config: providerConfig,
            recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
            subject,
            message,
          })

          await prisma.notificationDelivery.create({
            data: {
              notificationId: `periodic-${studentId}-${period}-${Date.now()}`,
              provider: config.provider,
              recipient: guardian.email || guardian.phone || guardian.whatsapp || '',
              status: result.success ? 'DELIVERED' : 'FAILED',
              providerResponse: result.response,
              errorMessage: result.error,
              sentAt: new Date(),
              deliveredAt: result.success ? new Date() : null,
            },
          })

<<<<<<< HEAD
          results.push({
            studentId,
            guardianId: guardian.id,
            provider: config.provider,
            status: result.success ? 'DELIVERED' : 'FAILED',
          })
        } catch (error) {
          results.push({
            studentId,
            guardianId: guardian.id,
            provider: config.provider,
            status: 'FAILED',
            error: error instanceof Error ? error.message : 'Unknown',
          })
=======
          results.push({ studentId, guardianId: guardian.id, provider: config.provider, status: result.success ? 'DELIVERED' : 'FAILED' })
        } catch (error) {
          results.push({ studentId, guardianId: guardian.id, provider: config.provider, status: 'FAILED', error: error instanceof Error ? error.message : 'Unknown' })
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
        }
      }
    }
  }

  await AuditLogService.log({
    institutionId,
    action: 'PERIODIC_REPORTS_SENT',
    entityType: 'PeriodicReport',
<<<<<<< HEAD
    newValues: {
      period,
      semesterId,
      totalStudents: studentIds.length,
      deliveries: results.length,
    },
=======
    newValues: { period, semesterId, totalStudents: studentIds.length, deliveries: results.length },
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
  })

  return NextResponse.json({ sent: results.length, results })
}

function formatReportMessage(student: any, report: any, period: string): string {
  const lines = [
    `Dear Guardian,`,
    ``,
    `This is the ${period} academic report for ${student.firstName} ${student.lastName}.`,
    ``,
    `Overall Attendance: ${report.summary.overallAttendance}%`,
    `Overall Average Marks: ${report.summary.overallMarks !== null ? report.summary.overallMarks + '%' : 'N/A'}`,
    ``,
    `Subject-wise Details:`,
  ]

  for (const subject of report.subjects) {
    lines.push(`  ${subject.subjectCode} - ${subject.subjectName}:`)
<<<<<<< HEAD
    lines.push(
      `    Attendance: ${subject.attendance.percentage}% (${subject.attendance.present}/${subject.attendance.total})`
    )
=======
    lines.push(`    Attendance: ${subject.attendance.percentage}% (${subject.attendance.present}/${subject.attendance.total})`)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
    if (subject.averageMarks !== null) {
      lines.push(`    Average Marks: ${subject.averageMarks}%`)
    }
  }

<<<<<<< HEAD
  lines.push(
    ``,
    `Please contact the institution for any queries.`,
    `Regards,`,
    `ALEX Academic System`
  )
=======
  lines.push(``, `Please contact the institution for any queries.`, `Regards,`, `ALEX Academic System`)
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad

  return lines.join('\n')
}
