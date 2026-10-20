import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "./index";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const documentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  subjectId: z.string().optional(),
  projectId: z.string().optional(),
  notebookId: z.string().optional(),
  fileName: z.string(),
  mimeType: z.string(),
  fileSize: z.number(),
});

export const documentFunctions = {
  createDocument: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = documentSchema.parse(request.data);
    const docId = uuidv4();
    const storagePath = `${request.auth.uid}/${docId}/${data.fileName}`;
    
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: data.mimeType,
    });
    
    await db.collection("documents").doc(docId).set({
      ...data,
      id: docId,
      ownerId: request.auth.uid,
      storagePath,
      storageBucket: bucket.name,
      checksum: "",
      status: "UPLOADED",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { documentId: docId, uploadUrl: signedUrl };
  }),

  confirmUpload: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { documentId, checksum } = request.data;
    const docRef = db.collection("documents").doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) throw new HttpsError("not-found", "Document not found");
    if (doc.data()?.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    await docRef.update({
      checksum,
      status: "QUEUED",
      processedAt: null,
    });
    
    await db.collection("documentProcessingJobs").add({
      documentId,
      step: "queued",
      status: "QUEUED",
      createdAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  getDocuments: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { subjectId, projectId, notebookId, status, limit = 20, cursor } = request.data;
    let query = db.collection("documents").where("ownerId", "==", request.auth.uid);
    
    if (subjectId) query = query.where("subjectId", "==", subjectId);
    if (projectId) query = query.where("projectId", "==", projectId);
    if (notebookId) query = query.where("notebookId", "==", notebookId);
    if (status) query = query.where("status", "==", status);
    
    query = query.orderBy("createdAt", "desc").limit(limit);
    
    if (cursor) {
      const cursorDoc = await db.collection("documents").doc(cursor).get();
      query = query.startAfter(cursorDoc);
    }
    
    const snapshot = await query.get();
    const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const nextCursor = docs.length === limit ? docs[docs.length - 1].id : null;
    
    return { documents: docs, nextCursor };
  }),

  getDocument: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const doc = await db.collection("documents").doc(request.data.documentId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Document not found");
    
    const data = doc.data();
    if (data?.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    return { id: doc.id, ...data };
  }),

  deleteDocument: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const docRef = db.collection("documents").doc(request.data.documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) throw new HttpsError("not-found", "Document not found");
    if (doc.data()?.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    const bucket = storage.bucket();
    await bucket.file(doc.data()?.storagePath || "").delete().catch(() => {});
    
    const chunks = await db.collection("documentChunks").where("documentId", "==", request.data.documentId).get();
    const batch = db.batch();
    chunks.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    
    await docRef.delete();
    return { success: true };
  }),

  retryProcessing: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const docRef = db.collection("documents").doc(request.data.documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) throw new HttpsError("not-found", "Document not found");
    if (doc.data()?.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    await docRef.update({ status: "QUEUED" });
    await db.collection("documentChunks").where("documentId", "==", request.data.documentId).get()
      .then(snapshot => {
        const batch = db.batch();
        snapshot.docs.forEach(d => batch.delete(d.ref));
        return batch.commit();
      });
    
    await db.collection("documentProcessingJobs").add({
      documentId: request.data.documentId,
      step: "retry",
      status: "QUEUED",
      createdAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  getSignedDownloadUrl: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const doc = await db.collection("documents").doc(request.data.documentId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Document not found");
    
    const data = doc.data();
    const hasAccess = data?.ownerId === request.auth.uid ||
      (data?.subjectId && await checkSubjectAccess(request.auth.uid, data.subjectId)) ||
      (data?.projectId && await checkProjectAccess(request.auth.uid, data.projectId)) ||
      (data?.notebookId && await checkNotebookAccess(request.auth.uid, data.notebookId));
    
    if (!hasAccess) throw new HttpsError("permission-denied", "Not authorized");
    
    const bucket = storage.bucket();
    const file = bucket.file(data?.storagePath || "");
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });
    
    return { url };
  }),
};

async function checkSubjectAccess(userId: string, subjectId: string): Promise<boolean> {
  const enrollment = await db.collection("subjectEnrollments")
    .where("userId", "==", userId)
    .where("subjectId", "==", subjectId)
    .where("isActive", "==", true)
    .limit(1)
    .get();
  return !enrollment.empty;
}

async function checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
  const member = await db.collection("projectMembers")
    .where("userId", "==", userId)
    .where("projectId", "==", projectId)
    .limit(1)
    .get();
  return !member.empty;
}

async function checkNotebookAccess(userId: string, notebookId: string): Promise<boolean> {
  const notebook = await db.collection("researchNotebooks").doc(notebookId).get();
  if (!notebook.exists) return false;
  const data = notebook.data();
  return data?.ownerId === userId || 
    (data?.projectId && await checkProjectAccess(userId, data.projectId));
}