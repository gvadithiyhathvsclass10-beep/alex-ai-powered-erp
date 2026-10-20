import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "./index";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import * as crypto from "crypto";
import { ragFunctions } from "./rag";
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
  subjectId: z.string().optional(),
  projectId: z.string().optional(),
  notebookId: z.string().optional(),
  documentIds: z.array(z.string()).optional(),
  stream: z.boolean().default(false),
});

const credentialSchema = z.object({
  provider: z.enum(["OPENAI", "GOOGLE_GEMINI", "ANTHROPIC", "MISTRAL", "GROQ", "OPENROUTER", "TOGETHER_AI"]),
  providerName: z.string(),
  apiKey: z.string(),
  isDefault: z.boolean().default(false),
});

export const aiFunctions = {
  sendMessage: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = chatSchema.parse(request.data);
    
    let conversationId = data.conversationId;
    if (!conversationId) {
      const convRef = await db.collection("conversations").add({
        userId: request.auth.uid,
        title: data.message.slice(0, 50),
        subjectId: data.subjectId,
        projectId: data.projectId,
        notebookId: data.notebookId,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      conversationId = convRef.id;
    }
    
    await db.collection("conversations").doc(conversationId).collection("messages").add({
      conversationId,
      senderId: request.auth.uid,
      role: "user",
      content: data.message,
      createdAt: FieldValue.serverTimestamp(),
    });
    
    const credentials = await db.collection("aiCredentials")
      .where("userId", "==", request.auth.uid)
      .where("isActive", "==", true)
      .where("isDefault", "==", true)
      .limit(1)
      .get();
    
    if (credentials.empty) {
      throw new HttpsError("failed-precondition", "No AI provider configured");
    }
    
    const credential = credentials.docs[0].data();
    const decryptedKey = decrypt(credential.encryptedKey, credential.keyHash);
    
    let answer: string;
    if (data.documentIds?.length || data.subjectId || data.projectId || data.notebookId) {
      const ragResult = await ragFunctions.ragQuery({
        query: data.message,
        subjectId: data.subjectId,
        projectId: data.projectId,
        notebookId: data.notebookId,
        documentIds: data.documentIds,
      }, request.auth);
      answer = ragResult.answer;
    } else {
      answer = await generateGeneralAnswer(data.message, credential.provider, decryptedKey);
    }
    
    const messageRef = await db.collection("conversations").doc(conversationId).collection("messages").add({
      conversationId,
      senderId: "assistant",
      role: "assistant",
      content: answer,
      createdAt: FieldValue.serverTimestamp(),
    });
    
    await db.collection("conversations").doc(conversationId).update({
      updatedAt: FieldValue.serverTimestamp(),
      lastMessage: answer.slice(0, 100),
    });
    
    return { conversationId, messageId: messageRef.id, answer };
  }),

  getConversations: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const snapshot = await db.collection("conversations")
      .where("userId", "==", request.auth.uid)
      .orderBy("updatedAt", "desc")
      .limit(20)
      .get();
    
    return {
      conversations: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    };
  }),

  getConversationMessages: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { conversationId, limit = 50, cursor } = request.data;
    
    const convDoc = await db.collection("conversations").doc(conversationId).get();
    if (!convDoc.exists) throw new HttpsError("not-found", "Conversation not found");
    if (convDoc.data()?.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    let query = db.collection("conversations").doc(conversationId).collection("messages")
      .orderBy("createdAt", "desc")
      .limit(limit);
    
    if (cursor) {
      const cursorDoc = await db.collection("conversations").doc(conversationId).collection("messages").doc(cursor).get();
      query = query.startAfter(cursorDoc);
    }
    
    const snapshot = await query.get();
    return {
      messages: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse(),
    };
  }),

  deleteConversation: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const convDoc = await db.collection("conversations").doc(request.data.conversationId).get();
    if (!convDoc.exists) throw new HttpsError("not-found", "Conversation not found");
    if (convDoc.data()?.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    await db.collection("conversations").doc(request.data.conversationId).delete();
    return { success: true };
  }),

  addCredential: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const data = credentialSchema.parse(request.data);
    const encryptedKey = encrypt(data.apiKey);
    const keyHash = hashKey(data.apiKey);
    
    await db.collection("aiCredentials").where("userId", "==", request.auth.uid)
      .where("provider", "==", data.provider)
      .where("isDefault", "==", true)
      .get()
      .then(snapshot => {
        if (!snapshot.empty) {
          snapshot.docs.forEach(doc => doc.ref.update({ isDefault: false }));
        }
      });
    
    await db.collection("aiCredentials").add({
      userId: request.auth.uid,
      provider: data.provider,
      providerName: data.providerName,
      encryptedKey,
      keyHash,
      isActive: true,
      isDefault: data.isDefault,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    
    return { success: true };
  }),

  getCredentials: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const snapshot = await db.collection("aiCredentials")
      .where("userId", "==", request.auth.uid)
      .where("isActive", "==", true)
      .get();
    
    return {
      credentials: snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        encryptedKey: undefined,
        keyHash: undefined,
      })),
    };
  }),

  deleteCredential: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const docRef = db.collection("aiCredentials").doc(request.data.credentialId);
    const doc = await docRef.get();
    if (!doc.exists) throw new HttpsError("not-found", "Credential not found");
    if (doc.data()?.userId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Not authorized");
    }
    
    await docRef.delete();
    return { success: true };
  }),

  testConnection: onCall(async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Must be logged in");
    
    const { provider, apiKey } = request.data;
    try {
      await testProviderConnection(provider, apiKey);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }),
};

async function generateGeneralAnswer(message: string, provider: string, apiKey: string): Promise<string> {
  switch (provider) {
    case "OPENAI": {
      const openai = (await import("openai")).default;
      const client = new openai.OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are ALEX, an AI academic assistant." },
          { role: "user", content: message },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      });
      return response.choices[0].message.content || "";
    }
    case "GOOGLE_GEMINI": {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      const result = await model.generateContent(message);
      return result.response.text();
    }
    case "ANTHROPIC": {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: message }],
        max_tokens: 2000,
      });
      // Handle different content block types
      const content = response.content[0];
      return 'text' in content ? content.text : String(content);
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

async function testProviderConnection(provider: string, apiKey: string): Promise<void> {
  switch (provider) {
    case "OPENAI": {
      const openai = (await import("openai")).default;
      const client = new openai.OpenAI({ apiKey });
      await client.models.list();
      break;
    }
    case "GOOGLE_GEMINI": {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
      await model.generateContent("test");
      break;
    }
    case "ANTHROPIC": {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: "claude-3-5-sonnet-20241022",
        messages: [{ role: "user", content: "test" }],
        max_tokens: 10,
      });
      break;
    }
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}

function encrypt(text: string): string {
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

function decrypt(encryptedData: string, keyHash: string): string {
  const algorithm = "aes-256-gcm";
  const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || "default-key", "salt", 32);
  const buffer = Buffer.from(encryptedData, "base64");
  const iv = buffer.subarray(0, 16);
  const authTag = buffer.subarray(16, 32);
  const encrypted = buffer.subarray(32);
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}