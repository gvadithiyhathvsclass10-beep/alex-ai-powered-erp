import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./index";
import { z } from "zod";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const sessionSchema = z.object({
  subjectId: z.string(),
  semesterId: z.string(),
  date: z.string(),
  period: z.number().int().min(1),
  topic: z.string().optional(),
});

const recordSchema = z.object({
  sessionId: z.string(),
  userId: z.string(),
  status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED", "ON_DUTY"]),
});

export const attendanceFunctions = {
  createSession: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = sessionSchema.parse(request.data);
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", data.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    const existing = await db.collection("attendanceSessions")
      .where("subjectId", "==", data.subjectId)
      .where("date", "==", Timestamp.fromDate(new Date(data.date)))
      .where("period", "==", data.period)
      .limit(1)
      .get();
    
    if (!existing.empty) throw new HttpsError("already-exists", "Session already exists");
    
    const docRef = await db.collection("attendanceSessions").add({
      ...data,
      date: Timestamp.fromDate(new Date(data.date)),
      conductedBy: request.auth.uid,
      isCancelled: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    const students = await db.collection("subjectEnrollments")
      .where("subjectId", "==", data.subjectId)
      .where("isActive", "==", true)
      .get();
    
    const batch = db.batch();
    students.docs.forEach(enrollment => {
      const recordRef = db.collection("attendanceRecords").doc();
      batch.set(recordRef, {
        sessionId: docRef.id,
        userId: enrollment.data()?.userId,
        status: "ABSENT",
        markedBy: request.auth.uid,
        markedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    
    return { sessionId: docRef.id };
  }),

  getSessions: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { subjectId, startDate, endDate } = request.data;
    let query = db.collection("attendanceSessions");
    
    if (subjectId) query = query.where("subjectId", "==", subjectId);
    if (startDate) query = query.where("date", ">=", Timestamp.fromDate(new Date(startDate)));
    if (endDate) query = query.where("date", "<=", Timestamp.fromDate(new Date(endDate)));
    
    const snapshot = await query.orderBy("date", "desc").orderBy("period").get();
    
    return {
      sessions: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  markAttendance: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { sessionId, records } = request.data;
    
    const session = await db.collection("attendanceSessions").doc(sessionId).get();
    if (!session.exists) throw new HttpsError("not-found", "Session not found");
    if (session.data()?.conductedBy !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only the lecturer can mark attendance");
    }
    
    const batch = db.batch();
    for (const record of records) {
      recordSchema.parse(record);
      const recordRef = db.collection("attendanceRecords")
        .where("sessionId", "==", sessionId)
        .where("userId", "==", record.userId)
        .limit(1);
      
      const existing = await recordRef.get();
      if (!existing.empty) {
        batch.update(existing.docs[0].ref, {
          status: record.status,
          markedBy: request.auth.uid,
          markedAt: FieldValue.serverTimestamp(),
        });
      } else {
        const recordRef = db.collection("attendanceRecords").doc();
        batch.set(recordRef, {
          sessionId,
          userId: record.userId,
          status: record.status,
          markedBy: request.auth.uid,
          markedAt: FieldValue.serverTimestamp(),
        });
      }
    }
    await batch.commit();
    
    return { success: true };
  }),

  getMyAttendance: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const enrollments = await db.collection("subjectEnrollments")
      .where("userId", "==", request.auth.uid)
      .where("isActive", "==", true)
      .get();
    
    let totalPresent = 0;
    let totalAbsent = 0;
    let totalConducted = 0;
    
    const subjects = await Promise.all(enrollments.docs.map(async enrollment => {
      const sessions = await db.collection("attendanceSessions")
        .where("subjectId", "==", enrollment.data()?.subjectId)
        .where("isCancelled", "==", false)
        .get();
      
      let present = 0;
      let absent = 0;
      
      for (const session of sessions.docs) {
        const record = await db.collection("attendanceRecords")
          .where("sessionId", "==", session.id)
          .where("userId", "==", request.auth.uid)
          .limit(1)
          .get();
        
        if (!record.empty) {
          if (record.docs[0].data()?.status === "PRESENT" || record.docs[0].data()?.status === "LATE") {
            present++;
          } else {
            absent++;
          }
        }
      }
      
      totalPresent += present;
      totalAbsent += absent;
      totalConducted += sessions.docs.length;
      
      const subject = await db.collection("subjects").doc(enrollment.data()?.subjectId).get();
      
      return {
        subjectId: enrollment.data()?.subjectId,
        subjectName: subject.exists ? subject.data()?.name : "Unknown",
        subjectCode: subject.exists ? subject.data()?.code : "Unknown",
        present,
        absent,
        total: sessions.docs.length,
        percentage: sessions.docs.length > 0 ? Math.round((present / sessions.docs.length) * 100) : 0,
      };
    }));
    
    return {
      subjects,
      overallPercentage: totalConducted > 0 ? Math.round((totalPresent / totalConducted) * 100) : 0,
      totalPresent,
      totalAbsent,
      totalConducted,
    };
  }),
};