export interface Message {
  role: "user" | "assistant"
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messageCount: number
}