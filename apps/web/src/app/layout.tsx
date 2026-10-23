import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { ThemeProvider } from "next-themes"
import { AuthProvider } from "@/components/auth/AuthProvider"
<<<<<<< HEAD
import { Toaster } from "@/components/ui/toaster"
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "ALEX - Academic Intelligence Platform",
  description: "AI-powered student intelligence and academic management platform",
  keywords: ["education", "AI", "student", "academic", "RAG", "study", "planner"],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>
            {children}
<<<<<<< HEAD
            <Toaster />
=======
>>>>>>> 3357b0a9168e2206891dc3b70db4d79b01212aad
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}