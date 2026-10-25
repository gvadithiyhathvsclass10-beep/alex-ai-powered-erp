"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getInitials } from "@/lib/utils"
import {
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
  Bot,
  Zap,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface AssistantHeaderProps {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
    role: string
  }
}

export function AssistantHeader({ user }: AssistantHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const getPageTitle = () => {
    const segments = pathname.split("/").filter(Boolean)
    if (segments.length <= 1) return "Dashboard"
    const last = segments[segments.length - 1]
    return last.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      
      <div className="flex h-16 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-4">
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-foreground tracking-tight">{getPageTitle()}</h1>
            <p className="text-xs text-muted-foreground/70">ALEX Academic Intelligence Platform</p>
          </div>
          
          {pathname.includes("/assistant") && (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
              <div className="relative flex h-2 w-2 rounded-full bg-neon-green">
                <div className="absolute inset-0 rounded-full bg-neon-green opacity-50 animate-ping" />
              </div>
              <span className="text-xs font-medium text-primary">AI Ready</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  aria-label="Toggle theme"
                  className="h-10 w-10 rounded-xl transition-all duration-200 hover:bg-secondary hover:border-border"
                >
                  <div className="relative h-5 w-5">
                    <Sun className="h-5 w-5 rotate-0 scale-100 transition-all duration-300 text-amber-400 dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute top-0 left-0 h-5 w-5 rotate-90 scale-0 transition-all duration-300 text-primary dark:rotate-0 dark:scale-100" />
                  </div>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="bg-card border-border">
                {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-xl transition-all duration-200 hover:bg-secondary hover:border-border" aria-label="User menu">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatarUrl || undefined} alt={user.firstName} />
                  <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                    {getInitials(`${user.firstName} ${user.lastName}`)}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-background border-2 border-background">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon-green" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 bg-card border-border/50 shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]" align="end" forceMount>
              <DropdownMenuLabel className="font-normal px-2 py-1">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold text-foreground">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Bot className="h-3 w-3 text-primary" />
                    <span className="text-xs text-primary font-medium capitalize">{user.role.toLowerCase().replace("_", " ")}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="border-border/50" />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex w-full items-center gap-2 px-2 py-2 text-sm transition-colors hover:bg-secondary rounded-lg -mx-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/ai-settings" className="flex w-full items-center gap-2 px-2 py-2 text-sm transition-colors hover:bg-secondary rounded-lg -mx-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-foreground">AI Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex w-full items-center gap-2 px-2 py-2 text-sm transition-colors hover:bg-secondary rounded-lg -mx-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="border-border/50" />
              <DropdownMenuItem
                className="flex w-full items-center gap-2 px-2 py-2 text-sm text-destructive transition-colors hover:bg-destructive/10 rounded-lg -mx-2 focus:text-destructive"
                onClick={() => router.push("/api/auth/logout")}
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}