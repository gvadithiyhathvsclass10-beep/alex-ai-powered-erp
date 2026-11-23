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
  Users,
  Library,
  Archive,
  Shield,
  Plus,
  Mic2,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: string[];
  badge?: string;
  section?: "main" | "lecturer" | "admin";
  hiddenFromMobile?: boolean;
  /** Tools are secondary actions that point at a destination already present in
   *  the main navigation (e.g. "Create Subject" -> Subjects). They are listed
   *  in the drawer/More sheet but never claim the primary active highlight. */
  isTool?: boolean;
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
  { label: "Online Tests", href: "/dashboard/online-tests", icon: FileText, roles: ["STUDENT", "LECTURER"], section: "main" },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"], section: "main" },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"], section: "main" },
];

// ============================================================================
// LECTURER-ONLY ITEMS
// ============================================================================
export const lecturerOnlyItems: NavItem[] = [
  { label: "Create Subject", href: "/dashboard/subjects", icon: Plus, roles: ["LECTURER", "ADMIN"], section: "lecturer", isTool: true },
  { label: "Mark Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["LECTURER"], section: "lecturer", isTool: true },
  { label: "Create Assessment", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["LECTURER"], section: "lecturer", isTool: true },
  { label: "Manage Resources", href: "/dashboard/subjects", icon: Library, roles: ["LECTURER", "ADMIN"], section: "lecturer", isTool: true },
];

// ============================================================================
// ADMIN-ONLY ITEMS
// ============================================================================
export const adminOnlyItems: NavItem[] = [
  { label: "User Management", href: "/dashboard/settings", icon: Users, roles: ["ADMIN"], section: "admin", isTool: true },
  { label: "Institution Settings", href: "/dashboard/settings", icon: Shield, roles: ["ADMIN"], section: "admin", isTool: true },
  { label: "Academic Calendar", href: "/dashboard/planner", icon: Calendar, roles: ["ADMIN"], section: "admin", isTool: true },
  { label: "Audit Logs", href: "/dashboard/notifications", icon: Archive, roles: ["ADMIN"], section: "admin", isTool: true },
];

// ============================================================================
// MOBILE BOTTOM NAV (most frequently used items)
// The order is deliberate: each role gets exactly four destinations plus the
// More sheet. Keeping the count stable avoids the cramped/broken grid the old
// label-based "More" detection produced for admins and mentors.
// ============================================================================
export const bottomNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["STUDENT", "LECTURER", "ADMIN", "PROJECT_MENTOR"] },
  { label: "AI Chat", href: "/dashboard/assistant", icon: Bot, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"], badge: "AI" },
  { label: "Documents", href: "/dashboard/documents", icon: FolderOpen, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Planner", href: "/dashboard/planner", icon: Calendar, roles: ["STUDENT"] },
  { label: "Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["LECTURER"] },
  { label: "Research", href: "/dashboard/research", icon: FlaskConical, roles: ["PROJECT_MENTOR"] },
  { label: "Subjects", href: "/dashboard/subjects", icon: Book, roles: ["ADMIN"] },
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["ADMIN"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["ADMIN"] },
];

// ============================================================================
// MORE MENU ITEMS (overflow from bottom nav)
// ============================================================================
export const moreMenuItems: NavItem[] = [
  { label: "Study Studio", href: "/dashboard/study-studio", icon: BookOpen, roles: ["STUDENT"] },
  { label: "Voice Assistant", href: "/dashboard/voice-assistant", icon: Mic2, roles: ["STUDENT"] },
  { label: "Subjects", href: "/dashboard/subjects", icon: Book, roles: ["STUDENT", "LECTURER", "ADMIN"] },
  { label: "Research Lab", href: "/dashboard/research", icon: FlaskConical, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Personal Drive", href: "/dashboard/drive", icon: Cloud, roles: ["STUDENT", "LECTURER", "PROJECT_MENTOR"] },
  { label: "Attendance", href: "/dashboard/attendance", icon: UserCheck, roles: ["STUDENT", "LECTURER"] },
  { label: "Assessments", href: "/dashboard/assessments", icon: ClipboardCheck, roles: ["STUDENT", "LECTURER"] },
  { label: "Online Tests", href: "/dashboard/online-tests", icon: FileText, roles: ["STUDENT", "LECTURER"] },
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
// HELPERS
// ============================================================================

function uniqueByHref(items: NavItem[]): NavItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.href)) return false;
    seen.add(item.href);
    return true;
  });
}

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

/** Exactly four destinations for the bottom bar (More is appended by the UI). */
export function getBottomNavItemsForRole(userRole: string): NavItem[] {
  return bottomNavItems.filter(item => item.roles.includes(userRole)).slice(0, 4);
}

/**
 * Overflow destinations for the More sheet. Deduplicated by href so tools such
 * as "Create Subject" do not create a second row for the same page.
 */
export function getMoreMenuItemsForRole(userRole: string): NavItem[] {
  const primaryHrefs = new Set(getBottomNavItemsForRole(userRole).map((item) => item.href));
  const candidates = [
    ...moreMenuItems.filter(item => item.roles.includes(userRole)),
    ...mainNavItems.filter(item => item.roles.includes(userRole)),
  ];

  return uniqueByHref(candidates).filter((item) => !primaryHrefs.has(item.href));
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

function normalizePathname(pathname: string): string {
  if (!pathname) return "/";
  const trimmed = pathname.split("?")[0].split("#")[0];
  return trimmed.length > 1 ? trimmed.replace(/\/+$/, "") : trimmed;
}

/**
 * Route-aware active matching.
 *
 * The dashboard is the index of every nested route, so a plain
 * `startsWith("/dashboard/")` check used to highlight Dashboard on every page.
 * The dashboard is therefore exact-match only; every other destination also
 * matches its own descendants.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  const current = normalizePathname(pathname);
  const target = normalizePathname(href);

  if (target === "/dashboard") {
    return current === "/dashboard" || current === "/dashboard/dashboard";
  }

  return current === target || current.startsWith(`${target}/`);
}

/** Longest matching destination wins, so nested routes highlight one item. */
export function resolveActiveNavHref(items: NavItem[], pathname: string): string | null {
  const matches = items
    .filter((item) => isNavItemActive(pathname, item.href))
    .sort((a, b) => b.href.length - a.href.length);

  return matches[0]?.href ?? null;
}

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/dashboard": "Dashboard",
  "/dashboard/assistant": "AI Assistant",
  "/dashboard/voice-assistant": "Voice Assistant",
  "/dashboard/documents": "Documents",
  "/dashboard/drive": "Personal Drive",
  "/dashboard/study-studio": "Study Studio",
  "/dashboard/planner": "Smart Planner",
  "/dashboard/subjects": "Subjects",
  "/dashboard/research": "Research Lab",
  "/dashboard/attendance": "Attendance",
  "/dashboard/assessments": "Assessments",
  "/dashboard/online-tests": "Online Tests",
  "/dashboard/notifications": "Notifications",
  "/dashboard/settings": "Settings",
  "/dashboard/ai-settings": "AI Settings",
  "/dashboard/achievements": "Achievements",
  "/dashboard/document-studio": "Document Studio",
  "/dashboard/solution-generator": "Solution Generator",
};

/** Human-readable title for the current route (used by the mobile header). */
export function getPageTitle(pathname: string): string {
  const current = normalizePathname(pathname);
  if (PAGE_TITLES[current]) return PAGE_TITLES[current];

  // Longest prefix match for nested routes such as /dashboard/online-tests/lecturer
  const prefix = Object.keys(PAGE_TITLES)
    .filter((key) => key !== "/dashboard" && current.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];

  if (prefix) return PAGE_TITLES[prefix];

  const last = current.split("/").filter(Boolean).pop();
  if (!last) return "Dashboard";
  return last.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}
