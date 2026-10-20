import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./index";
import { z } from "zod";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const searchSchema = z.object({
  query: z.string().min(1),
  subjectId: z.string().optional(),
  projectId: z.string().optional(),
  notebookId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  limit: z.number().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
});

const ragQuerySchema = z.object({
  query: z.string().min(1),
  subjectId: z.string().optional(),
  projectId: z.string().optional(),
  notebookId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  limit: z.number().min(1).max(20).default(10),
  threshold: z.number().min(0).max(1).default(0.7),
  stream: z.boolean().default(false),
});

interface SearchResultChunk {
  id: string;
  documentTitle: string;
  pageNumber?: number;
  sectionTitle?: string;
  content: string;
  distance: number;
  documentId: string;
  similarity: number;
}

async function semanticSearchImpl(data: z.infer<typeof ragQuerySchema>, auth: any): Promise<{ chunks: SearchResultChunk[] }> {
  if (!auth) throw new HttpsError("unauthenticated", "Must be logged in");
  
  const queryEmbedding = await generateEmbedding(data.query);
  
  let query = db.collection("documentChunks")
    .where("ownerId", "==", auth.uid)
    .where("embedding", "!=", null)
    .limit(data.limit);
  
  if (data.subjectId) query = query.where("subjectId", "==", data.subjectId);
  if (data.projectId) query = query.where("projectId", "==", data.projectId);
  if (data.notebookId) query = query.where("notebookId", "==", data.notebookId);
  if (data.documentIds?.length) query = query.where("documentId", "in", data.documentIds);
  
  const snapshot = await query.get();
  
  const chunks: SearchResultChunk[] = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      documentTitle: data.documentTitle || "",
      pageNumber: data.pageNumber,
      sectionTitle: data.sectionTitle,
      content: data.content || "",
      distance: 0,
      documentId: data.documentId || "",
      similarity: 0.5,
    };
  });
  
  return { chunks };
}

export const ragFunctions = {
  search: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = searchSchema.parse(request.data);
    
    let query = db.collection("documentChunks")
      .where("ownerId", "==", request.auth.uid);
    
    if (data.subjectId) query = query.where("subjectId", "==", data.subjectId);
    if (data.projectId) query = query.where("projectId", "==", data.projectId);
    if (data.notebookId) query = query.where("notebookId", "==", data.notebookId);
    if (data.documentIds?.length) query = query.where("documentId", "in", data.documentIds);
    
    const snapshot = await query
      .where("embedding", "!=", null)
      .limit(data.limit)
      .get();
    
    const chunks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return { chunks };
  }),

  semanticSearch: onCall(async (request) => {
    return semanticSearchImpl(request.data, request.auth);
  }),

  ragQuery: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = ragQuerySchema.parse(request.data);
    
    const searchResults = await semanticSearchImpl(data, request.auth);
    
    if (searchResults.chunks.length === 0) {
      return {
        answer: "I could not find any relevant information in your documents to answer this question.",
        citations: [],
        sources: [],
      };
    }
    
    const context = searchResults.chunks
      .map((chunk: SearchResultChunk, i: number) => 
        `[Source ${i + 1}] (${chunk.documentTitle}${chunk.pageNumber ? `, p.${chunk.pageNumber}` : ""}${chunk.sectionTitle ? `, ${chunk.sectionTitle}` : ""}):\n${chunk.content}`
      )
      .join("\n\n---\n\n");
    
    const systemPrompt = `You are ALEX, an AI academic assistant. Answer questions using ONLY the provided sources.
- Cite sources using [Source X] format
- If the sources don't contain enough information, say so clearly
- Distinguish between retrieved facts and your own reasoning
- Be concise but thorough
- Never fabricate citations or page numbers`;
    
    const answer = await generateAnswer(data.query, context, systemPrompt);
    
    const citations = extractCitations(answer, searchResults.chunks);
    
    return {
      answer,
      citations,
      sources: searchResults.chunks,
    };
  }),

  getDocumentChunks: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const chunks = await db.collection("documentChunks")
      .where("documentId", "==", request.data.documentId)
      .where("ownerId", "==", request.auth.uid)
      .orderBy("chunkIndex")
      .get();
    
    return {
      chunks: chunks.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),
};

async function generateEmbedding(text: string): Promise<number[]> {
  const openai = (await import("openai")).default;
  const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    encoding_format: "float",
  });
  
  return response.data[0].embedding;
}

async function generateAnswer(query: string, context: string, systemPrompt: string): Promise<string> {
  const openai = (await import("openai")).default;
  const client = new openai.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await client.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Question: ${query}\n\nSources:\n${context}` },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  });
  
  return response.choices[0].message.content || "";
}

function extractCitations(answer: string, chunks: SearchResultChunk[]): Array<{sourceIndex: number; documentTitle: string; pageNumber?: number; excerpt: string; id: string; documentId: string; relevanceScore: number}> {
  const citations: Array<{sourceIndex: number; documentTitle: string; pageNumber?: number; excerpt: string; id: string; documentId: string; relevanceScore: number}> = [];
  const sourceRegex = /\[Source (\d+)\]/g;
  let match;
  
  while ((match = sourceRegex.exec(answer)) !== null) {
    const sourceIndex = parseInt(match[1]) - 1;
    if (sourceIndex >= 0 && sourceIndex < chunks.length) {
      const chunk = chunks[sourceIndex];
      citations.push({
        id: chunk.id,
        documentId: chunk.documentId,
        documentTitle: chunk.documentTitle,
        pageNumber: chunk.pageNumber,
        sectionTitle: chunk.sectionTitle,
        excerpt: chunk.content.slice(0, 200) + (chunk.content.length > 200 ? "..." : ""),
        relevanceScore: chunk.similarity,
      });
    }
  }
  
  return citations;
}