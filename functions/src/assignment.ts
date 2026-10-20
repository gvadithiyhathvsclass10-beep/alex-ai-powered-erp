import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "./index";
import { z } from "zod";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const assignmentSchema = z.object({
  subjectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  instructions: z.string().optional(),
  maxMarks: z.number().int().min(1),
  weight: z.number().min(0).default(1.0),
  assignedDate: z.string(),
  dueDate: z.string(),
  allowedFormats: z.array(z.string()).default([]),
  allowResubmission: z.boolean().default(false),
  maxSubmissions: z.number().int().min(1).default(1),
});

const submissionSchema = z.object({
  assignmentId: z.string(),
  content: z.string().optional(),
  files: z.array(z.object({
    fileName: z.string(),
    storagePath: z.string(),
    mimeType: z.string(),
    fileSize: z.number(),
  })).default([]),
});

export const assignmentFunctions = {
  createAssignment: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = assignmentSchema.parse(request.data);
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", data.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    const docRef = await db.collection("assignments").add({
      ...data,
      assignedDate: Timestamp.fromDate(new Date(data.assignedDate)),
      dueDate: Timestamp.fromDate(new Date(data.dueDate)),
      isPublished: false,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { assignmentId: docRef.id };
  }),

  getAssignments: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { subjectId, isPublished } = request.data;
    let query = db.collection("assignments");
    
    if (subjectId) query = query.where("subjectId", "==", subjectId);
    if (isPublished !== undefined) query = query.where("isPublished", "==", isPublished);
    
    const snapshot = await query.orderBy("dueDate", "asc").get();
    
    return {
      assignments: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  getMyAssignments: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const enrollments = await db.collection("subjectEnrollments")
      .where("userId", "==", request.auth.uid)
      .where("isActive", "==", true)
      .get();
    
    const subjectIds = enrollments.docs.map(d => d.data()?.subjectId).filter(Boolean);
    
    if (subjectIds.length === 0) return { assignments: [] };
    
    const assignments = await db.collection("assignments")
      .where("subjectId", "in", subjectIds)
      .where("isPublished", "==", true)
      .orderBy("dueDate", "asc")
      .get();
    
    const submissions = await db.collection("assignmentSubmissions")
      .where("userId", "==", request.auth.uid)
      .where("assignmentId", "in", assignments.docs.map(d => d.id))
      .get();
    
    const submissionMap = new Map();
    submissions.docs.forEach(d => {
      const existing = submissionMap.get(d.data()?.assignmentId) || [];
      existing.push({ id: d.id, ...d.data() });
      submissionMap.set(d.data()?.assignmentId, existing);
    });
    
    return {
      assignments: assignments.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          submissions: submissionMap.get(doc.id) || [],
          isOverdue: data.dueDate?.toDate?.() < new Date() && !submissionMap.get(doc.id)?.length,
        };
      }),
    };
  }),

  submitAssignment: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = submissionSchema.parse(request.data);
    
    const assignment = await db.collection("assignments").doc(data.assignmentId).get();
    if (!assignment.exists) throw new HttpsError("not-found", "Assignment not found");
    if (!assignment.data()?.isPublished) throw new HttpsError("failed-precondition", "Assignment not published");
    
    const existingCount = await db.collection("assignmentSubmissions")
      .where("assignmentId", "==", data.assignmentId)
      .where("userId", "==", request.auth.uid)
      .count()
      .get();
    
    if (existingCount.data().count >= assignment.data()?.maxSubmissions && !assignment.data()?.allowResubmission) {
      throw new HttpsError("failed-precondition", "Maximum submissions reached");
    }
    
    const isLate = assignment.data()?.dueDate?.toDate?.() < new Date();
    
    const docRef = await db.collection("assignmentSubmissions").add({
      ...data,
      userId: request.auth.uid,
      status: isLate ? "LATE" : "SUBMITTED",
      submissionNumber: existingCount.data().count + 1,
      submittedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { submissionId: docRef.id };
  }),

  getSubmissions: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { assignmentId } = request.data;
    
    const assignment = await db.collection("assignments").doc(assignmentId).get();
    if (!assignment.exists) throw new HttpsError("not-found", "Assignment not found");
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", assignment.data()?.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    const submissions = await db.collection("assignmentSubmissions")
      .where("assignmentId", "==", assignmentId)
      .orderBy("submittedAt", "desc")
      .get();
    
    return {
      submissions: submissions.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  gradeSubmission: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { submissionId, marksObtained, feedback } = request.data;
    
    const submission = await db.collection("assignmentSubmissions").doc(submissionId).get();
    if (!submission.exists) throw new HttpsError("not-found", "Submission not found");
    
    const assignment = await db.collection("assignments").doc(submission.data()?.assignmentId).get();
    if (!assignment.exists) throw new HttpsError("not-found", "Assignment not found");
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", assignment.data()?.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    await db.collection("assignmentSubmissions").doc(submissionId).update({
      status: "EVALUATED",
      marksObtained,
      feedback,
      gradedBy: request.auth.uid,
      gradedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  publishAssignment: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { assignmentId } = request.data;
    
    const docRef = db.collection("assignments").doc(assignmentId);
    const doc = await docRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "Assignment not found");
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", doc.data()?.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    await docRef.update({
      isPublished: true,
    });
    
    return { success: true };
  }),
};