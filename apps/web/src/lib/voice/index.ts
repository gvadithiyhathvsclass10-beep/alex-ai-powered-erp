"use client"

export interface VoiceProvider {
  name: string
  supportsSTT: boolean
  supportsTTS: boolean
  languages: string[]
}

export interface STTOptions {
  language?: string
  continuous?: boolean
  interimResults?: boolean
  onResult: (transcript: string, isFinal: boolean) => void
  onError: (error: string) => void
  onStart: () => void
  onEnd: () => void
}

export interface TTSOptions {
  text: string
  language?: string
  voice?: string
  rate?: number
  pitch?: number
  volume?: number
  onStart: () => void
  onEnd: () => void
  onError: (error: string) => void
}

export class BrowserSpeechProvider implements VoiceProvider {
  name = 'browser'
  supportsSTT = typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)
  supportsTTS = typeof window !== 'undefined' && 'speechSynthesis' in window
  languages = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'ja-JP', 'ko-KR', 'zh-CN']

  private recognition: any = null
  private utterance: SpeechSynthesisUtterance | null = null

  startListening(options: STTOptions): void {
    if (!this.supportsSTT) {
      options.onError('Speech recognition not supported in this browser')
      return
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    this.recognition = new SpeechRecognition()
    this.recognition.continuous = options.continuous ?? false
    this.recognition.interimResults = options.interimResults ?? true
    this.recognition.lang = options.language || 'en-US'

    this.recognition.onstart = () => options.onStart()
    this.recognition.onend = () => options.onEnd()

    this.recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0].transcript)
        .join('')
      
      options.onResult(transcript, event.results[0].isFinal)
    }

    this.recognition.onerror = (event: any) => {
      options.onError(event.error)
    }

    try {
      this.recognition.start()
    } catch (error) {
      options.onError('Failed to start speech recognition')
    }
  }

  stopListening(): void {
    if (this.recognition) {
      this.recognition.stop()
      this.recognition = null
    }
  }

  speak(options: TTSOptions): void {
    if (!this.supportsTTS) {
      options.onError('Text-to-speech not supported in this browser')
      return
    }

    window.speechSynthesis.cancel()

    this.utterance = new SpeechSynthesisUtterance(options.text)
    this.utterance.lang = options.language || 'en-US'
    this.utterance.rate = options.rate ?? 1
    this.utterance.pitch = options.pitch ?? 1
    this.utterance.volume = options.volume ?? 1

    if (options.voice) {
      const voices = window.speechSynthesis.getVoices()
      const voice = voices.find(v => v.name === options.voice || v.lang.startsWith(options.language || 'en'))
      if (voice) this.utterance.voice = voice
    }

    this.utterance.onstart = () => options.onStart()
    this.utterance.onend = () => options.onEnd()
    this.utterance.onerror = (event) => options.onError(event.error)

    window.speechSynthesis.speak(this.utterance)
  }

  stopSpeaking(): void {
    window.speechSynthesis.cancel()
  }

  getVoices(): SpeechSynthesisVoice[] {
    return window.speechSynthesis.getVoices()
  }
}

export class ServerTTSProvider implements VoiceProvider {
  name = 'server-tts'
  supportsSTT = false
  supportsTTS = true
  languages = ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-PT', 'pl-PL', 'hi-IN', 'zh-CN', 'ja-JP', 'ko-KR']

  private provider: 'elevenlabs' | 'openai'
  private baseUrl: string

  constructor(provider: 'elevenlabs' | 'openai', baseUrl = '') {
    this.provider = provider
    this.baseUrl = baseUrl
  }

  async speak(options: TTSOptions): Promise<void> {
    options.onStart()

    try {
      const endpoint = this.provider === 'elevenlabs'
        ? '/api/ai/voice/tts/elevenlabs'
        : '/api/ai/voice/tts/openai'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: options.text,
          voice: options.voice,
          rate: options.rate,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `${this.provider} TTS error: ${response.statusText}`)
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      const audio = new Audio(audioUrl)
      
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        options.onEnd()
      }
      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl)
        options.onError('Failed to play audio')
      }
      
      audio.play()
    } catch (error) {
      options.onError(error instanceof Error ? error.message : 'TTS failed')
    }
  }
}

export function createVoiceProvider(
  type: 'browser' | 'elevenlabs' | 'openai-tts',
  _apiKey?: string,
  baseUrl = ''
): VoiceProvider {
  switch (type) {
    case 'browser':
      return new BrowserSpeechProvider()
    case 'elevenlabs':
      return new ServerTTSProvider('elevenlabs', baseUrl)
    case 'openai-tts':
      return new ServerTTSProvider('openai', baseUrl)
    default:
      throw new Error(`Unknown voice provider: ${type}`)
  }
}

export async function getUserVoiceConfig(): Promise<{
  sttProvider: "browser"
  ttsProvider: "browser" | "elevenlabs" | "openai-tts"
  hasSttCredential: boolean
  hasTtsCredential: boolean
  defaultLanguage: string
} | null> {
  try {
    const response = await fetch('/api/ai/voice-config')
    if (!response.ok) return null
    const data = await response.json()
    return {
      sttProvider: 'browser',
      ttsProvider: data.ttsProvider || 'browser',
      hasSttCredential: data.hasSttCredential || false,
      hasTtsCredential: data.hasTtsCredential || false,
      defaultLanguage: data.defaultLanguage || 'en-US',
    }
  } catch {
    return {
      sttProvider: 'browser',
      ttsProvider: 'browser',
      hasSttCredential: false,
      hasTtsCredential: false,
      defaultLanguage: 'en-US',
    }
  }
}