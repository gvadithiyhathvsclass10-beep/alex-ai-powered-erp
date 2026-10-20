import * as functions from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onDocumentCreated, onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { onSchedule } from "firebase-functions/v2/scheduler";

initializeApp();

const db = getFirestore();
const authAdmin = getAuth();
const storageAdmin = getStorage();

export { db, authAdmin as auth, storageAdmin as storage };

import { userFunctions } from "./user";
import { documentFunctions } from "./document";
import { ragFunctions } from "./rag";
import { aiFunctions } from "./ai";
import { studyFunctions } from "./study";
import { plannerFunctions } from "./planner";
import { researchFunctions } from "./research";
import { projectFunctions } from "./project";
import { attendanceFunctions } from "./attendance";
import { assessmentFunctions } from "./assessment";
import { assignmentFunctions } from "./assignment";
import { achievementFunctions } from "./achievement";


export const api = {
  ...userFunctions,
  ...documentFunctions,
  ...ragFunctions,
  ...aiFunctions,
  ...studyFunctions,
  ...plannerFunctions,
  ...researchFunctions,
  ...projectFunctions,
  ...attendanceFunctions,
  ...assessmentFunctions,
  ...assignmentFunctions,
  ...achievementFunctions,
};

export const onUserCreate = onDocumentCreated("users/{userId}", async (event) => {
  const snap = event.data;
  if (!snap) return;
  
  const userData = snap.data();
  if (!userData) return;
  
  await event.data.ref.set({
    ...userData,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
});

export const onDocumentUpload = onObjectFinalized(async (event) => {
  const object = event.data;
  const filePath = object.name;
  const bucketName = object.bucket;
  
  if (!filePath || filePath.startsWith("temp/")) return;
  
await db.collection("documentProcessingJobs").add({
    filePath,
    bucket: bucketName,
    status: "QUEUED",
    createdAt: FieldValue.serverTimestamp(),
  });
});

export const scheduledCleanup = onSchedule({ schedule: "0 2 * * *", timeZone: "UTC" }, async () => {
    const thirtyDaysAgo = Timestamp.fromDate(
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    );
    
    const oldNotifications = await db
      .collection("notifications")
      .where("createdAt", "<", thirtyDaysAgo)
      .where("isRead", "==", true)
      .limit(500)
      .get();
    
    const batch = db.batch();
    oldNotifications.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    
    return null;
  });

export const scheduledAttendanceAlerts = onSchedule({ schedule: "0 8 * * *", timeZone: "UTC" }, async () => {
    const usersSnapshot = await db.collection("users").where("role", "==", "STUDENT").get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const enrollments = await db
        .collection("subjectEnrollments")
        .where("userId", "==", userId)
        .where("isActive", "==", true)
        .get();
      
      for (const enrollment of enrollments.docs) {
        const sessions = await db
          .collection("attendanceSessions")
          .where("subjectId", "==", enrollment.data()?.subjectId)
          .where("isCancelled", "==", false)
          .get();
        
        let present = 0;
        let total = 0;
        
        for (const session of sessions.docs) {
          const record = await db
            .collection("attendanceRecords")
            .where("sessionId", "==", session.id)
            .where("userId", "==", userId)
            .limit(1)
            .get();
          
          if (!record.empty) {
            total++;
            if (record.docs[0].data()?.status === "PRESENT") present++;
          }
        }
        
        if (total > 0) {
          const percentage = (present / total) * 100;
          if (percentage < 35) {
            await db.collection("notifications").add({
              userId,
              category: "ATTENDANCE",
              title: "Low Attendance Alert",
              message: `Your attendance is ${percentage.toFixed(1)}%. Please attend classes regularly.`,
              isRead: false,
              createdAt: FieldValue.serverTimestamp(),
            });
          }
        }
      }
    }
    
    return null;
  });

