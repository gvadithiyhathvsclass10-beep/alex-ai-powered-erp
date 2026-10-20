import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, auth } from "./index";
import { z } from "zod";
import { FieldValue } from "firebase-admin/firestore";

const userSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["STUDENT", "LECTURER", "ADMIN"]),
  institutionId: z.string().optional(),
  departmentId: z.string().optional(),
  courseId: z.string().optional(),
  semesterId: z.string().optional(),
});

export const userFunctions = {
  createUserProfile: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = userSchema.parse(request.data);
    
    await db.collection("users").doc(request.auth.uid).set({
      ...data,
      uid: request.auth.uid,
      emailVerified: false,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  getUserProfile: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const doc = await db.collection("users").doc(request.auth.uid).get();
    if (!doc.exists) throw new HttpsError("not-found", "User not found");
    
    return { id: doc.id, ...doc.data() };
  }),

  updateUserProfile: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const updates = request.data;
    delete updates.uid;
    delete updates.email;
    delete updates.role;
    
    await db.collection("users").doc(request.auth.uid).update({
      ...updates,
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  getUsersByRole: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const userDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!userDoc.exists) throw new HttpsError("not-found", "User not found");
    
    const userData = userDoc.data();
    if (!userData || (userData.role !== "ADMIN" && userData.role !== "LECTURER")) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    const { role, institutionId, limit = 50 } = request.data;
    let query = db.collection("users").where("role", "==", role).limit(limit);
    
    if (institutionId) {
      query = query.where("institutionId", "==", institutionId);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }),

  setUserRole: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const adminDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== "ADMIN") {
      throw new HttpsError("permission-denied", "Only admins can change roles");
    }
    
    const { userId, role } = request.data;
    await db.collection("users").doc(userId).update({ role });
    return { success: true };
  }),

  deactivateUser: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const adminDoc = await db.collection("users").doc(request.auth.uid).get();
    if (!adminDoc.exists || adminDoc.data()?.role !== "ADMIN") {
      throw new HttpsError("permission-denied", "Only admins can deactivate users");
    }
    
    const { userId } = request.data;
    await db.collection("users").doc(userId).update({ isActive: false });
    await auth.revokeRefreshTokens(userId);
    return { success: true };
  }),
};