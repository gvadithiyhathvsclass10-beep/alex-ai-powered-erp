import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "./index";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const achievementSchema = z.object({
  title: z.string().min(1),
  category: z.enum(["INTERNSHIP", "CERTIFICATION", "WORKSHOP", "HACKATHON", "RESEARCH_PUBLICATION", "TECHNICAL_COMPETITION", "CLUB_ACTIVITY", "VOLUNTEERING", "PROJECT", "AWARD", "PLACEMENT_PREPARATION", "OTHER"]),
  organization: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  certificateUrl: z.string().optional(),
});

export const achievementFunctions = {
  createAchievement: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = achievementSchema.parse(request.data);
    
    const docRef = await db.collection("studentAchievements").add({
      ...data,
      userId: request.auth.uid,
      startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
      endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
      status: "COMPLETED",
      verificationStatus: "UNVERIFIED",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { achievementId: docRef.id };
  }),

  getAchievements: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const snapshot = await db.collection("studentAchievements")
      .where("userId", "==", request.auth.uid)
      .orderBy("createdAt", "desc")
      .get();
    
    return {
      achievements: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  updateAchievement: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { achievementId, ...updates } = request.data;
    const docRef = db.collection("studentAchievements").doc(achievementId);
    const doc = await docRef.get();
    
    if (!doc.exists) throw new HttpsError("not-found", "Achievement not found");
    if (doc.data()?.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    if (updates.startDate) updates.startDate = Timestamp.fromDate(new Date(updates.startDate));
    if (updates.endDate) updates.endDate = Timestamp.fromDate(new Date(updates.endDate));
    
    await docRef.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
  }),

  deleteAchievement: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const docRef = db.collection("studentAchievements").doc(request.data.achievementId);
    const doc = await docRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "Achievement not found");
    if (doc.data()?.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    await docRef.delete();
    return { success: true };
  }),

  uploadCertificate: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { achievementId, fileName, mimeType, fileSize } = request.data;
    
    const docRef = db.collection("studentAchievements").doc(achievementId);
    const doc = await docRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "Achievement not found");
    if (doc.data()?.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    const storagePath = `${request.auth.uid}/achievements/${achievementId}/${fileName}`;
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    const [signedUrl] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + 15 * 60 * 1000,
      contentType: mimeType,
    });
    
    return { uploadUrl: signedUrl, storagePath };
  }),

  verifyCertificate: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { achievementId } = request.data;
    
    const docRef = db.collection("studentAchievements").doc(achievementId);
    const doc = await docRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "Achievement not found");
    
    // Check if user is admin or lecturer
    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!userDoc.exists) throw new HttpsError("not-found", "User not found");
    
    const userData = userDoc.data();
    if (!userData || (userData.role !== "ADMIN" && userData.role !== "LECTURER")) {
      throw new HttpsError("permission-denied", "Only admins and lecturers can verify");
    }
    
    await docRef.update({
      verificationStatus: "VERIFIED",
      verifiedBy: request.auth.uid,
      verifiedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  downloadPortfolio: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const achievements = await db.collection("studentAchievements")
      .where("userId", "==", request.auth.uid)
      .orderBy("createdAt", "desc")
      .get();
    
    const portfolio = {
      student: request.auth.uid,
      generatedAt: new Date().toISOString(),
      achievements: achievements.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        startDate: doc.data()?.startDate?.toDate?.toISOString?.(),
        endDate: doc.data()?.endDate?.toDate?.toISOString?.(),
        createdAt: doc.data()?.createdAt?.toDate?.toISOString?.(),
        updatedAt: doc.data()?.updatedAt?.toDate?.toISOString?.(),
      })),
    };
    
    return { portfolio };
  }),
};