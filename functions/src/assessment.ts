import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./index";
import { z } from "zod";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const assessmentSchema = z.object({
  subjectId: z.string(),
  semesterId: z.string(),
  name: z.string().min(1),
  type: z.enum(["INTERNAL_ASSESSMENT", "ASSIGNMENT", "QUIZ", "LAB_ASSESSMENT", "PROJECT", "PRESENTATION", "PRACTICAL_EXAM", "SEMESTER_EXAM", "OTHER"]),
  maxMarks: z.number().int().min(1),
  weight: z.number().min(0).default(1.0),
  assessmentDate: z.string(),
  description: z.string().optional(),
});

const resultSchema = z.object({
  assessmentId: z.string(),
  userId: z.string(),
  marksObtained: z.number().min(0),
  feedback: z.string().optional(),
});

export const assessmentFunctions = {
  createAssessment: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = assessmentSchema.parse(request.data);
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", data.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    const docRef = await db.collection("assessments").add({
      ...data,
      assessmentDate: Timestamp.fromDate(new Date(data.assessmentDate)),
      isPublished: false,
      createdBy: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { assessmentId: docRef.id };
  }),

  getAssessments: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { subjectId, semesterId, isPublished } = request.data;
    let query = db.collection("assessments");
    
    if (subjectId) query = query.where("subjectId", "==", subjectId);
    if (semesterId) query = query.where("semesterId", "==", semesterId);
    if (isPublished !== undefined) query = query.where("isPublished", "==", isPublished);
    
    const snapshot = await query.orderBy("assessmentDate", "desc").get();
    
    return {
      assessments: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  publishAssessment: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { assessmentId } = request.data;
    
    const docRef = db.collection("assessments").doc(assessmentId);
    const doc = await docRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "Assessment not found");
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", doc.data()?.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    await docRef.update({
      isPublished: true,
      publishedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  submitResult: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = resultSchema.parse(request.data);
    
    const assessment = await db.collection("assessments").doc(data.assessmentId).get();
    if (!assessment.exists) throw new HttpsError("not-found", "Assessment not found");
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", assessment.data()?.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    const existing = await db.collection("assessmentResults")
      .where("assessmentId", "==", data.assessmentId)
      .where("userId", "==", data.userId)
      .limit(1)
      .get();
    
    if (!existing.empty) {
      await existing.docs[0].ref.update({
        marksObtained: data.marksObtained,
        feedback: data.feedback,
        gradedBy: request.auth.uid,
        gradedAt: FieldValue.serverTimestamp(),
      });
    } else {
      await db.collection("assessmentResults").add({
        ...data,
        gradedBy: request.auth.uid,
        gradedAt: FieldValue.serverTimestamp(),
        isPublished: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    
    return { success: true };
  }),

  publishResults: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { assessmentId } = request.data;
    
    const assessment = await db.collection("assessments").doc(assessmentId).get();
    if (!assessment.exists) throw new HttpsError("not-found", "Assessment not found");
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", assessment.data()?.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    const results = await db.collection("assessmentResults")
      .where("assessmentId", "==", assessmentId)
      .get();
    
    const batch = db.batch();
    results.docs.forEach(doc => {
      batch.update(doc.ref, {
        isPublished: true,
        publishedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    
    await db.collection("assessments").doc(assessmentId).update({
      isPublished: true,
      publishedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  getMyResults: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const results = await db.collection("assessmentResults")
      .where("userId", "==", request.auth.uid)
      .where("isPublished", "==", true)
      .orderBy("gradedAt", "desc")
      .get();
    
    return {
      results: results.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  getAssessmentResults: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { assessmentId } = request.data;
    
    const assessment = await db.collection("assessments").doc(assessmentId).get();
    if (!assessment.exists) throw new HttpsError("not-found", "Assessment not found");
    
    const enrollment = await db.collection("lecturerAssignments")
      .where("userId", "==", request.auth.uid)
      .where("subjectId", "==", assessment.data()?.subjectId)
      .limit(1)
      .get();
    
    if (enrollment.empty) throw new HttpsError("permission-denied", "Not assigned to this subject");
    
    const results = await db.collection("assessmentResults")
      .where("assessmentId", "==", assessmentId)
      .get();
    
    return {
      results: results.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),
};