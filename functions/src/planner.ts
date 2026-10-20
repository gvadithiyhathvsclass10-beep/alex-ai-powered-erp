import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./index";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: z.string(),
  endTime: z.string(),
  allDay: z.boolean().default(false),
  eventType: z.string(),
  subjectId: z.string().optional(),
  taskId: z.string().optional(),
});

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.number().default(0),
});

export const plannerFunctions = {
  createEvent: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = eventSchema.parse(request.data);
    
    const docRef = await db.collection("plannerEvents").add({
      ...data,
      userId: request.auth.uid,
      startTime: Timestamp.fromDate(new Date(data.startTime)),
      endTime: Timestamp.fromDate(new Date(data.endTime)),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { id: docRef.id };
  }),

  getEvents: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { startDate, endDate } = request.data;
    let query = db.collection("plannerEvents").where("userId", "==", request.auth.uid);
    
    if (startDate) query = query.where("startTime", ">=", Timestamp.fromDate(new Date(startDate)));
    if (endDate) query = query.where("startTime", "<=", Timestamp.fromDate(new Date(endDate)));
    
    const snapshot = await query.orderBy("startTime").get();
    
    return {
      events: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  createTask: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = taskSchema.parse(request.data);
    
    const docRef = await db.collection("tasks").add({
      ...data,
      userId: request.auth.uid,
      creatorId: request.auth.uid,
      assigneeId: request.auth.uid,
      dueDate: data.dueDate ? Timestamp.fromDate(new Date(data.dueDate)) : null,
      isCompleted: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { id: docRef.id };
  }),

  getTasks: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { status } = request.data;
    let query = db.collection("tasks").where("assigneeId", "==", request.auth.uid);
    
    if (status) query = query.where("isCompleted", "==", status === "completed");
    
    const snapshot = await query.orderBy("dueDate").get();
    
    return {
      tasks: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  updateTask: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { taskId, ...updates } = request.data;
    const taskRef = db.collection("tasks").doc(taskId);
    const task = await taskRef.get();
    
    if (!task.exists) throw new HttpsError("not-found", "Task not found");
    if (task.data()?.assigneeId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    if (updates.completedAt) {
      updates.completedAt = Timestamp.fromDate(new Date(updates.completedAt));
    }
    if (updates.dueDate) {
      updates.dueDate = Timestamp.fromDate(new Date(updates.dueDate));
    }
    
    await taskRef.update({ ...updates, updatedAt: FieldValue.serverTimestamp() });
    return { success: true };
  }),

  generateStudyPlan: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { goals, availableHours, subjects, startDate, endDate } = request.data;
    
    const assessments = await db.collection("assessments")
      .where("subjectId", "in", subjects)
      .where("assessmentDate", ">=", Timestamp.fromDate(new Date()))
      .where("assessmentDate", "<=", Timestamp.fromDate(new Date(endDate)))
      .where("isPublished", "==", true)
      .get();
    
    const assignments = await db.collection("assignments")
      .where("subjectId", "in", subjects)
      .where("dueDate", ">=", Timestamp.fromDate(new Date()))
      .where("dueDate", "<=", Timestamp.fromDate(new Date(endDate)))
      .where("isPublished", "==", true)
      .get();
    
    const prompt = `Generate a study plan:
Goals: ${goals}
Available hours/week: ${availableHours}
Subjects: ${subjects.join(", ")}
Period: ${startDate} to ${endDate}
Upcoming assessments: ${assessments.docs.map(d => `${d.data().name} (${d.data().subjectId}) - ${d.data().assessmentDate.toDate()}`).join("; ")}
Assignments: ${assignments.docs.map(d => `${d.data().title} - ${d.data().dueDate.toDate()}`).join("; ")}
Generate a weekly schedule with daily study sessions.`;
    
    const plan = await generateWithAI(prompt);
    
    const planRef = await db.collection("studyPlans").add({
      userId: request.auth.uid,
      goals,
      availableHours,
      subjects,
      startDate,
      endDate,
      plan,
      createdAt: FieldValue.serverTimestamp(),
    });
    
    return { planId: planRef.id, plan };
  }),

  getDailyBriefing: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [events, tasks, assessments, assignments] = await Promise.all([
      db.collection("plannerEvents")
        .where("userId", "==", request.auth.uid)
        .where("startTime", ">=", Timestamp.fromDate(today))
        .where("startTime", "<", Timestamp.fromDate(tomorrow))
        .orderBy("startTime")
        .get(),
      db.collection("tasks")
        .where("assigneeId", "==", request.auth.uid)
        .where("isCompleted", "==", false)
        .where("dueDate", "<=", Timestamp.fromDate(tomorrow))
        .orderBy("dueDate")
        .limit(10)
        .get(),
      db.collection("assessments")
        .where("userId", "==", request.auth.uid)
        .where("assessmentDate", ">=", Timestamp.fromDate(today))
        .where("assessmentDate", "<", Timestamp.fromDate(tomorrow))
        .where("isPublished", "==", true)
        .get(),
      db.collection("assignments")
        .where("userId", "==", request.auth.uid)
        .where("dueDate", ">=", Timestamp.fromDate(today))
        .where("dueDate", "<", Timestamp.fromDate(tomorrow))
        .where("isPublished", "==", true)
        .get(),
    ]);
    
    return {
      events: events.docs.map(d => ({ id: d.id, ...d.data() })),
      tasks: tasks.docs.map(d => ({ id: d.id, ...d.data() })),
      assessments: assessments.docs.map(d => ({ id: d.id, ...d.data() })),
      assignments: assignments.docs.map(d => ({ id: d.id, ...d.data() })),
    };
  }),
};

async function generateWithAI(prompt: string): Promise<string> {
  const openai = (await import("openai")).default;
  const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are ALEX, an AI academic planner." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 3000,
  });
  
  return response.choices[0].message.content || "";
}