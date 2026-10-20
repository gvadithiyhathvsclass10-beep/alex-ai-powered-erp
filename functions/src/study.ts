import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./index";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const noteSchema = z.object({
  title: z.string().min(1),
  content: z.string(),
  type: z.string(),
  sourceDocId: z.string().optional(),
  subjectId: z.string().optional(),
  topic: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const flashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
});

const deckSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  subjectId: z.string().optional(),
  sourceDocId: z.string().optional(),
  cards: z.array(flashcardSchema).min(1),
});

export const studyFunctions = {
  createStudyMaterial: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = noteSchema.parse(request.data);
    
    const docRef = await db.collection("studyMaterials").add({
      ...data,
      userId: request.auth.uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { id: docRef.id };
  }),

  getStudyMaterials: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { subjectId, type, limit = 20 } = request.data;
    let query = db.collection("studyMaterials").where("userId", "==", request.auth.uid);
    
    if (subjectId) query = query.where("subjectId", "==", subjectId);
    if (type) query = query.where("type", "==", type);
    
    const snapshot = await query.orderBy("createdAt", "desc").limit(limit).get();
    
    return {
      materials: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  generateNotes: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { sourceDocId, type } = request.data;
    
    const doc = await db.collection("documents").doc(sourceDocId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Source document not found");
    
    const chunks = await db.collection("documentChunks")
      .where("documentId", "==", sourceDocId)
      .orderBy("chunkIndex")
      .get();
    
    const content = chunks.docs.map(d => d.data()?.content).join("\n\n");
    
    const prompt = getNotePrompt(type, content);
    const notes = await generateWithAI(prompt);
    
    const noteRef = await db.collection("studyMaterials").add({
      userId: request.auth.uid,
      title: `${type} Notes - ${doc.data()?.title}`,
      content: notes,
      type,
      sourceDocId,
      subjectId: doc.data()?.subjectId,
      topic: type,
      tags: [type],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { id: noteRef.id, content: notes };
  }),

  createFlashcardDeck: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = deckSchema.parse(request.data);
    
    const deckRef = await db.collection("flashcardDecks").add({
      ...data,
      userId: request.auth.uid,
      algorithm: "SM2",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    const batch = db.batch();
    data.cards.forEach((card, index) => {
      const cardRef = db.collection("flashcards").doc();
      batch.set(cardRef, {
        deckId: deckRef.id,
        front: card.front,
        back: card.back,
        difficulty: 0,
        interval: 0,
        repetitions: 0,
        easeFactor: 2.5,
        nextReview: Timestamp.now(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    
    return { deckId: deckRef.id };
  }),

  getFlashcardDecks: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { subjectId } = request.data;
    let query = db.collection("flashcardDecks").where("userId", "==", request.auth.uid);
    
    if (subjectId) query = query.where("subjectId", "==", subjectId);
    
    const snapshot = await query.orderBy("createdAt", "desc").get();
    
    return {
      decks: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  getFlashcardsForReview: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { deckId } = request.data;
    const now = Timestamp.now();
    
    const cards = await db.collection("flashcards")
      .where("deckId", "==", deckId)
      .where("nextReview", "<=", now)
      .orderBy("nextReview")
      .limit(20)
      .get();
    
    return {
      cards: cards.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  reviewFlashcard: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { cardId, rating } = request.data;
    
    const cardRef = db.collection("flashcards").doc(cardId);
    const cardDoc = await cardRef.get();
    if (!cardDoc.exists) throw new HttpsError("not-found", "Card not found");
    
    const cardData = cardDoc.data() as { easeFactor: number; interval: number; repetitions: number };
    const { easeFactor, interval, repetitions } = cardData;
    
    let newEaseFactor = easeFactor;
    let newInterval = interval;
    let newRepetitions = repetitions;
    
    if (rating < 3) {
      newRepetitions = 0;
      newInterval = 1;
    } else {
      if (repetitions === 0) newInterval = 1;
      else if (repetitions === 1) newInterval = 6;
      else newInterval = Math.round(interval * easeFactor);
      newRepetitions += 1;
    }
    
    newEaseFactor = Math.max(1.3, easeFactor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02)));
    const nextReview = Timestamp.fromDate(
      new Date(Date.now() + newInterval * 24 * 60 * 60 * 1000)
    );
    
    await cardRef.update({
      easeFactor: newEaseFactor,
      interval: newInterval,
      repetitions: newRepetitions,
      nextReview,
      lastReviewed: Timestamp.now(),
      difficulty: Math.max(0, Math.min(1, 1 - (rating - 1) / 3)),
    });
    
    await db.collection("flashcardReviews").add({
      cardId,
      userId: request.auth.uid,
      rating,
      previousEase: easeFactor,
      newEase: newEaseFactor,
      previousInterval: interval,
      newInterval,
      reviewedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  generateQuiz: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { sourceDocId, numQuestions, difficulty } = request.data;
    
    const doc = await db.collection("documents").doc(sourceDocId).get();
    if (!doc.exists) throw new HttpsError("not-found", "Source document not found");
    
    const chunks = await db.collection("documentChunks")
      .where("documentId", "==", sourceDocId)
      .orderBy("chunkIndex")
      .get();
    
    const content = chunks.docs.map(d => d.data()?.content).join("\n\n");
    
    const prompt = `Generate ${numQuestions} ${difficulty} quiz questions based on this content. 
Format as JSON array with: {question, options: [A, B, C, D], correct: 0-3, explanation}
Content:\n${content}`;
    
    const quizContent = await generateWithAI(prompt);
    const questions = JSON.parse(quizContent);
    
    const quizRef = await db.collection("quizzes").add({
      userId: request.auth.uid,
      title: `Quiz - ${doc.data()?.title}`,
      subjectId: doc.data()?.subjectId,
      sourceDocId,
      difficulty,
      questions,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { quizId: quizRef.id, questions };
  }),
};

function getNotePrompt(type: string, content: string): string {
  const prompts: Record<string, string> = {
    concise: `Create concise study notes from this content. Focus on key points only.`,
    detailed: `Create detailed study notes with comprehensive coverage.`,
    exam: `Create exam-oriented notes focusing on high-yield topics.`,
    formulas: `Extract all formulas, equations, and constants.`,
    definitions: `Extract all key terms and definitions.`,
    comparison: `Create comparison tables for related concepts.`,
  };
  return `${prompts[type] || prompts.concise}\n\nContent:\n${content}`;
}

async function generateWithAI(prompt: string): Promise<string> {
  const openai = (await import("openai")).default;
  const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are ALEX, an AI academic assistant." },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 3000,
  });
  
  return response.choices[0].message.content || "";
}