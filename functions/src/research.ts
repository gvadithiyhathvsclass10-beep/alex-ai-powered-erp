import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./index";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const notebookSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  projectId: z.string().optional(),
  isPublic: z.boolean().default(false),
});

const sourceSchema = z.object({
  notebookId: z.string(),
  documentId: z.string().optional(),
  title: z.string().min(1),
  authors: z.array(z.string()).optional(),
  publicationYear: z.number().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
});

const noteSchema = z.object({
  notebookId: z.string(),
  title: z.string().min(1),
  content: z.string(),
  sourceIds: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const researchFunctions = {
  createNotebook: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = notebookSchema.parse(request.data);
    
    const docRef = await db.collection("researchNotebooks").add({
      ...data,
      ownerId: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { notebookId: docRef.id };
  }),

  getNotebooks: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const snapshot = await db.collection("researchNotebooks")
      .where("ownerId", "==", request.auth.uid)
      .orderBy("updatedAt", "desc")
      .get();
    
    return {
      notebooks: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  getNotebook: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const doc = await db.collection("researchNotebooks").doc(request.data.notebookId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Notebook not found");
    
    const data = doc.data();
    if (data?.ownerId !== request.auth.uid && !data?.isPublic) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    return { id: doc.id, ...data };
  }),

  addSource: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = sourceSchema.parse(request.data);
    
    const notebook = await db.collection("researchNotebooks").doc(data.notebookId).get();
    if (!notebook.exists) throw new HttpsError("not-found", "Notebook not found");
    if (notebook.data()?.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    const docRef = await db.collection("researchSources").add({
      ...data,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { sourceId: docRef.id };
  }),

  getSources: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const snapshot = await db.collection("researchSources")
      .where("notebookId", "==", request.data.notebookId)
      .orderBy("createdAt", "desc")
      .get();
    
    return {
      sources: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  createNote: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = noteSchema.parse(request.data);
    
    const notebook = await db.collection("researchNotebooks").doc(data.notebookId).get();
    if (!notebook.exists) throw new HttpsError("not-found", "Notebook not found");
    if (notebook.data()?.ownerId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    const docRef = await db.collection("researchNotes").add({
      ...data,
      userId: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { noteId: docRef.id };
  }),

  getNotes: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const snapshot = await db.collection("researchNotes")
      .where("notebookId", "==", request.data.notebookId)
      .orderBy("updatedAt", "desc")
      .get();
    
    return {
      notes: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  generateLiteratureReview: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { notebookId } = request.data;
    
    const sources = await db.collection("researchSources")
      .where("notebookId", "==", notebookId)
      .get();
    
    const notes = await db.collection("researchNotes")
      .where("notebookId", "==", notebookId)
      .get();
    
    const prompt = `Generate a literature review based on these sources and notes:
Sources: ${sources.docs.map(d => `- ${d.data()?.title} (${d.data()?.publicationYear || "N/A"})`).join("\n")}
Notes: ${notes.docs.map(d => `- ${d.data()?.title}: ${d.data()?.content.slice(0, 200)}`).join("\n")}
Generate a structured literature review with introduction, themes, gaps, and conclusion.`;
    
    const review = await generateWithAI(prompt);
    
    const noteRef = await db.collection("researchNotes").add({
      notebookId,
      userId: request.auth.uid,
      title: "Literature Review",
      content: review,
      sourceIds: sources.docs.map(d => d.id),
      tags: ["literature-review", "generated"],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { noteId: noteRef.id, review };
  }),

  analyzePaper: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { sourceId } = request.data;
    
    const source = await db.collection("researchSources").doc(sourceId).get();
    if (!source.exists) throw new HttpsError("not-found", "Source not found");
    
    const docId = source.data()?.documentId;
    if (!docId) throw new HttpsError("failed-precondition", "Source has no associated document");
    
    const doc = await db.collection("documents").doc(docId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Document not found");
    
    const chunks = await db.collection("documentChunks")
      .where("documentId", "==", docId)
      .orderBy("chunkIndex")
      .get();
    
    const content = chunks.docs.map(d => d.data()?.content).join("\n\n");
    
    const prompt = `Analyze this research paper and extract:
1. Methodology
2. Key findings
3. Datasets and evaluation metrics
3. Limitations
4. Related work comparison
5. Research questions addressed

Content:\n${content}`;
    
    const analysis = await generateWithAI(prompt);
    
    const noteRef = await db.collection("researchNotes").add({
      notebookId: source.data()?.notebookId,
      userId: request.auth.uid,
      title: `Analysis: ${source.data()?.title}`,
      content: analysis,
      sourceIds: [sourceId],
      tags: ["paper-analysis", "generated"],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { noteId: noteRef.id, analysis };
  }),
};

async function generateWithAI(prompt: string): Promise<string> {
  const openai = (await import("openai")).default;
  const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are ALEX, an AI research assistant." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 4000,
  });
  
  return response.choices[0].message.content || "";
}