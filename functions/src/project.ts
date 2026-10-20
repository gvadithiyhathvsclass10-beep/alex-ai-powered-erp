import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./index";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const projectSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).default([]),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

const taskSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.number().default(0),
});

const milestoneSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string(),
});

export const projectFunctions = {
  createProject: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = projectSchema.parse(request.data);
    
    const docRef = await db.collection("projects").add({
      ...data,
      ownerId: request.auth.uid,
      status: "PLANNING",
      startDate: data.startDate ? Timestamp.fromDate(new Date(data.startDate)) : null,
      endDate: data.endDate ? Timestamp.fromDate(new Date(data.endDate)) : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    await db.collection("projectMembers").add({
      projectId: docRef.id,
      userId: request.auth.uid,
      role: "OWNER",
      joinedAt: FieldValue.serverTimestamp(),
    });
    
    return { projectId: docRef.id };
  }),

  getProjects: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const owned = await db.collection("projects")
      .where("ownerId", "==", request.auth.uid)
      .orderBy("updatedAt", "desc")
      .get();
    
    const member = await db.collection("projectMembers")
      .where("userId", "==", request.auth.uid)
      .get();
    
    const memberProjects = await Promise.all(
      member.docs.map(async d => {
        const p = await db.collection("projects").doc(d.data()?.projectId).get();
        return p.exists ? { id: p.id, ...p.data() } : null;
      })
    );
    
    return {
      projects: [
        ...owned.docs.map(doc => ({ id: doc.id, ...doc.data() })),
        ...memberProjects.filter(p => p && p.id && !owned.docs.find(d => d.id === p.id)),
      ],
    };
  }),

  getProject: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const doc = await db.collection("projects").doc(request.data.projectId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Project not found");
    
    const data = doc.data();
    const isMember = await db.collection("projectMembers")
      .where("projectId", "==", doc.id)
      .where("userId", "==", request.auth.uid)
      .limit(1)
      .get();
    
    if (data?.ownerId !== request.auth.uid && isMember.empty) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    return { id: doc.id, ...data };
  }),

  addMember: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { projectId, userId, role } = request.data;
    
    const project = await db.collection("projects").doc(projectId).get();
    if (!project.exists) throw new HttpsError("not-found", "Project not found");
    if (project.data()?.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only owner can add members");
    }
    
    const existing = await db.collection("projectMembers")
      .where("projectId", "==", projectId)
      .where("userId", "==", userId)
      .limit(1)
      .get();
    
    if (!existing.empty) throw new HttpsError("already-exists", "User is already a member");
    
    await db.collection("projectMembers").add({
      projectId,
      userId,
      role: role || "MEMBER",
      joinedAt: FieldValue.serverTimestamp(),
      invitedBy: request.auth.uid,
    });
    
    return { success: true };
  }),

  createTask: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = taskSchema.parse(request.data);
    
    const project = await db.collection("projects").doc(data.projectId).get();
    if (!project.exists) throw new HttpsError("not-found", "Project not found");
    
    const isMember = await db.collection("projectMembers")
      .where("projectId", "==", data.projectId)
      .where("userId", "==", request.auth.uid)
      .limit(1)
      .get();
    
    if (isMember.empty) throw new HttpsError("permission-denied", "Not a project member");
    
    const docRef = await db.collection("projectTasks").add({
      ...data,
      creatorId: request.auth.uid,
      status: "TODO",
      dueDate: data.dueDate ? Timestamp.fromDate(new Date(data.dueDate)) : null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { taskId: docRef.id };
  }),

  getTasks: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { projectId, status } = request.data;
    let query = db.collection("projectTasks").where("projectId", "==", projectId);
    
    if (status) query = query.where("status", "==", status);
    
    const snapshot = await query.orderBy("createdAt", "desc").get();
    
    return {
      tasks: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  updateTask: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { taskId, ...updates } = request.data;
    const taskRef = db.collection("projectTasks").doc(taskId);
    const task = await taskRef.get();
    
    if (!task.exists) throw new HttpsError("not-found", "Task not found");
    
    const project = await db.collection("projects").doc(task.data()?.projectId).get();
    const isOwner = project.data()?.ownerId === request.auth.uid;
    const isAssignee = task.data()?.assigneeId === request.auth.uid;
    const isCreator = task.data()?.creatorId === request.auth.uid;
    
    if (!isOwner && !isAssignee && !isCreator) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    if (updates.dueDate) {
      updates.dueDate = Timestamp.fromDate(new Date(updates.dueDate));
    }
    if (updates.completedAt) {
      updates.completedAt = Timestamp.fromDate(new Date(updates.completedAt));
    }
    
    await taskRef.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
  }),

  createMilestone: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = milestoneSchema.parse(request.data);
    
    const project = await db.collection("projects").doc(data.projectId).get();
    if (!project.exists) throw new HttpsError("not-found", "Project not found");
    if (project.data()?.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only owner can create milestones");
    }
    
    const docRef = await db.collection("projectMilestones").add({
      ...data,
      dueDate: Timestamp.fromDate(new Date(data.dueDate)),
      isCompleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { milestoneId: docRef.id };
  }),
};