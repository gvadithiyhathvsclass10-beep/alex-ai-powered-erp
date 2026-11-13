/**
 * Canonical Navigation Configuration for ALEX
 * Single source of truth for all navigation items across the application.
 * Used by Sidebar, AssistantSidebar, MobileBottomNav, and any future navigation components.
 */

import {
  LayoutDashboard,
  Bot,
  FolderOpen,
  Cloud,
  BookOpen,
  Calendar,
  Book,
  FlaskConical,
  UserCheck,
  ClipboardCheck,
  FileText,
  Bell,
  Settings,
  GraduationCap,
  Users,
  Library,
  Archive,
  Shield,
  Plus,
  Mic2,
  Sparkles,
  Brain,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  badge?: string;
  section?: "main" | "lecturer" | "admin";
  hiddenFromMobile?: boolean;
}

// ============================================================================
// MAIN NAVIGATION ITEMS (shown to all eligible roles)
// ============================================================================
export const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"], section: "main" },
  { label: "AI Assistant", href: "/dashboard/assistant", icon: Bot, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"], badge: "AI", section: "main" },
  { label: "Voice Assistant", href: "/dashboard/voice-assistant", icon: Mic2, roles: ["STUDENT"], badge: "VOICE", section: "main" },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"], section: "main" },
  { label: "Personal Drive", href: "/dashboard/drive", icon: Cloud, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"], section: "main" },
  { label: "Study Studio", href: "/dashboard/study-studio", icon: BookOpen, roles: ["STUDENT"], section: "main" },
  { label: "Smart Planner", href: "/dashboard/planner", icon: Calendar, roles: ["STUDENT"], section: "main" },
  { label: "Subjects", href: "/dashboard/subjects", icon: Book, roles: ["STUDENT", "LECTURER", "ADMIN"], section: "main" },
  { label: "Research Lab", href: "/dashboard/research", icon: FlaskConical, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"], section: "main" },
  { label: "Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["STUDENT", "LECTURER"], section: "main" },
  { label: "Assessments", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["STUDENT", "LECTURER"], section: "main" },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"], section: "main" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"], section: "main" },
];

// ============================================================================
// LECTURER-ONLY ITEMS
// ============================================================================
export const lecturerOnlyItems: NavItem[] = [
  { label: "Create Subject", href: "/dashboard/subjects", icon: Plus, roles: ["LECTURER", "ADMIN"], section: "lecturer" },
  { label: "Mark Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["LECTURER"], section: "lecturer" },
  { label: "Create Assessment", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["LECTURER"], section: "lecturer" },
  { label: "Manage Resources", href: "/dashboard/subjects", icon: Library, roles: ["LECTURER", "ADMIN"], section: "lecturer" },
];

// ============================================================================
// ADMIN-ONLY ITEMS
// ============================================================================
export const adminOnlyItems: NavItem[] = [
  { label: "User Management", href: "/dashboard/settings", icon: Users, roles: ["ADMIN"], section: "admin" },
  { label: "Institution Settings", href: "/dashboard/settings", icon: Shield, roles: ["ADMIN"], section: "admin" },
  { label: "Academic Calendar", href: "/dashboard/planner", icon: Calendar, roles: ["ADMIN"], section: "admin" },
  { label: "Audit Logs", href: "/dashboard/notifications", icon: Archive, roles: ["ADMIN"], section: "admin" },
];

// ============================================================================
// MOBILE BOTTOM NAV (most frequently used items)
// ============================================================================
export const bottomNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "AI Chat", href: "/dashboard/assistant", icon: Bot, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"], badge: "AI" },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Planner", href: "/dashboard/planner", icon: Calendar, roles: ["STUDENT"] },
  { label: "More", href: "#", icon: Sparkles, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"], hiddenFromMobile: true },
];

// ============================================================================
// MORE MENU ITEMS (overflow from bottom nav)
// ============================================================================
export const moreMenuItems: NavItem[] = [
  { label: "Study Studio", href: "/dashboard/study-studio", icon: BookOpen, roles: ["STUDENT"] },
  { label: "Subjects", href: "/dashboard/subjects", icon: Book, roles: ["STUDENT", "LECTURER", "ADMIN"] },
  { label: "Research Lab", href: "/dashboard/research", icon: FlaskConical, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Personal Drive", href: "/dashboard/drive", icon: Cloud, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["STUDENT", "LECTURER"] },
  { label: "Assessments", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["STUDENT", "LECTURER"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
];

// ============================================================================
// ASSISTANT WORKSPACE SPECIFIC NAV (if different from main)
// Currently identical to main - kept for future customization
// ============================================================================
export const assistantWorkspaceNavItems: NavItem[] = [
  ...mainNavItems,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getNavItemsForRole(userRole: string, includeLecturer = true, includeAdmin = true): NavItem[] {
  let items = [...mainNavItems.filter(item => item.roles.includes(userRole))];
  
  if (includeLecturer && (userRole === "LECTURER" || userRole === "ADMIN")) {
    items = [...items, ...lecturerOnlyItems.filter(item => item.roles.includes(userRole))];
  }
  
  if (includeAdmin && userRole === "ADMIN") {
    items = [...items, ...adminOnlyItems.filter(item => item.roles.includes(userRole))];
  }
  
  return items;
}

export function getBottomNavItemsForRole(userRole: string): NavItem[] {
  return bottomNavItems.filter(item => item.roles.includes(userRole));
}

export function getMoreMenuItemsForRole(userRole: string): NavItem[] {
  let items = [...moreMenuItems.filter(item => item.roles.includes(userRole))];
  
  if (userRole === "LECTURER" || userRole === "ADMIN") {
    items = [...items, ...lecturerOnlyItems.filter(item => item.roles.includes(userRole))];
  }
  
  if (userRole === "ADMIN") {
    items = [...items, ...adminOnlyItems.filter(item => item.roles.includes(userRole))];
  }
  
  return items;
}

export function getSectionTitle(section: NavItem["section"]): string {
  switch (section) {
    case "main": return "Main Navigation";
    case "lecturer": return "Lecturer Tools";
    case "admin": return "Administration";
    default: return "";
  }
}

// Type guard for checking if we're on an assistant route
export function isAssistantRoute(pathname: string): boolean {
  return pathname.startsWith("/dashboard/assistant");
}

// All items combined for searching/matching
export const allNavItems = [
  ...mainNavItems,
  ...lecturerOnlyItems,
  ...adminOnlyItems,
];

// Find nav item by href
export function findNavItemByHref(href: string): NavItem | undefined {
  return allNavItems.find(item => item.href === href);
}