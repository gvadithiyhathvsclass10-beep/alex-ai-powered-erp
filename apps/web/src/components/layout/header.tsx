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
import { getPageTitle } from "@/lib/navigation/config"
import {
  LogOut,
  Moon,
  Settings,
  Sun,
  User,
  Bot,
  Zap,
  Menu,
  X,
  Bell,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface HeaderProps {
  user: {
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl: string | null
    role: string
  }
  menuOpen?: boolean
  onMenuClick?: () => void
}

export function Header({ user, menuOpen = false, onMenuClick }: HeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const pageTitle = getPageTitle(pathname)
  const fullName = `${user.firstName} ${user.lastName}`.trim()
  const initials = getInitials(fullName) || "A"

  const handleLogout = () => {
    router.push("/api/auth/logout")
  }

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border/50 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      {/* Subtle top glow line */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="flex h-14 min-w-0 items-center gap-2 px-3 sm:h-16 sm:gap-4 sm:px-6 lg:px-8">
        {/* Mobile drawer trigger — lives inside the header, never floats beside it */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl hover:bg-secondary lg:hidden"
          onClick={onMenuClick}
          aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>

        {/* Page identity */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
              {pageTitle}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground/70 sm:block">
              ALEX Academic Intelligence Platform
            </p>
          </div>

          {pathname.includes("/assistant") && (
            <div className="hidden shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 md:flex">
              <div className="relative flex h-2 w-2 rounded-full bg-neon-green">
                <div className="absolute inset-0 animate-ping rounded-full bg-neon-green opacity-50" />
              </div>
              <span className="text-xs font-medium text-primary">AI Ready</span>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-xl hover:bg-secondary"
                asChild
              >
                <Link href="/dashboard/notifications" aria-label="Notifications">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Notifications</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                aria-label="Toggle theme"
                className="h-10 w-10 shrink-0 rounded-xl transition-all duration-200 hover:border-border hover:bg-secondary"
              >
                <span className="relative h-5 w-5">
                  <Sun className="h-5 w-5 rotate-0 scale-100 text-amber-400 transition-all duration-300 dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute left-0 top-0 h-5 w-5 rotate-90 scale-0 text-primary transition-all duration-300 dark:rotate-0 dark:scale-100" />
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            </TooltipContent>
          </Tooltip>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 shrink-0 rounded-xl transition-all duration-200 hover:border-border hover:bg-secondary"
                aria-label="User menu"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={user.avatarUrl || undefined} alt={fullName || "User"} />
                  <AvatarFallback className="bg-gradient-primary font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="absolute bottom-1 right-1 flex h-3 w-3 items-center justify-center rounded-full border-2 border-background bg-background">
                  <span className="h-1.5 w-1.5 rounded-full bg-neon-green" />
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-[min(16rem,calc(100vw-1rem))] border-border/50 bg-card shadow-[0_0_40px_-10px_rgba(0,0,0,0.5)]"
              align="end"
              sideOffset={8}
              forceMount
            >
              <DropdownMenuLabel className="px-2 py-1 font-normal">
                <div className="flex min-w-0 flex-col space-y-1">
                  <p className="truncate text-sm font-semibold text-foreground">{fullName || "ALEX user"}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Bot className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium capitalize text-primary">
                      {user.role.toLowerCase().replace("_", " ")}
                    </span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="border-border/50" />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-secondary">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">Settings</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/settings" className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-secondary">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">Profile</span>
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm transition-colors hover:bg-secondary sm:hidden"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-primary" />}
                <span className="text-foreground">{theme === "dark" ? "Light mode" : "Dark mode"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="border-border/50" />
              <DropdownMenuItem
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10 focus:text-destructive"
                onClick={handleLogout}
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
