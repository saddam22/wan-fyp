import type { Area } from "@edukhata/contracts";

/** Sidebar navigation per dashboard area. Icons are lucide names resolved in the client shell. */
export interface NavLink {
  label: string;
  href: string;
  icon: string;
  badge?: number;
  /** Shown only to super admins (pages also enforce this). */
  superOnly?: boolean;
}
export interface NavGroup {
  title?: string;
  links: NavLink[];
}

export const AREA_TITLE: Record<Area, string> = {
  student: "Student Dashboard",
  mentor: "Mentor Dashboard",
  guardian: "Guardian Dashboard",
  admin: "Admin Dashboard",
  accountant: "Accountant Dashboard",
  "support-desk": "Supporter Dashboard",
};

export const NAV: Record<Area, NavGroup[]> = {
  student: [
    {
      links: [
        { label: "Dashboard", href: "/student", icon: "LayoutDashboard" },
        { label: "New Order", href: "/student/new-order", icon: "PlusCircle" },
        { label: "My Orders", href: "/student/orders", icon: "ClipboardList", badge: 3 },
        { label: "Messages", href: "/student/messages", icon: "MessageSquare", badge: 2 },
        { label: "Find Mentors", href: "/mentors", icon: "Search" },
        { label: "Favorite Mentors", href: "/student/favorites", icon: "Heart" },
      ],
    },
    {
      title: "Money",
      links: [
        { label: "Payments", href: "/student/payments", icon: "CreditCard" },
        { label: "Invoices", href: "/student/invoices", icon: "Receipt" },
        { label: "Refer & Earn", href: "/student/referrals", icon: "Gift" },
      ],
    },
    {
      title: "Account",
      links: [
        { label: "Notifications", href: "/student/notifications", icon: "Bell", badge: 3 },
        { label: "Support", href: "/student/support", icon: "LifeBuoy" },
        { label: "Profile", href: "/student/profile", icon: "UserRound" },
      ],
    },
  ],
  mentor: [
    {
      links: [
        { label: "Dashboard", href: "/mentor", icon: "LayoutDashboard" },
        { label: "New Requests", href: "/mentor/offers", icon: "Inbox", badge: 3 },
        { label: "My Orders", href: "/mentor/orders", icon: "ClipboardList" },
        { label: "Messages", href: "/mentor/messages", icon: "MessageSquare", badge: 2 },
        { label: "Calendar & Sessions", href: "/mentor/calendar", icon: "CalendarDays" },
      ],
    },
    {
      title: "Profile & services",
      links: [
        { label: "Services & Pricing", href: "/mentor/services", icon: "Tags" },
        { label: "Portfolio", href: "/mentor/portfolio", icon: "Images" },
        { label: "Profile", href: "/mentor/profile", icon: "UserRound" },
        { label: "Verification", href: "/mentor/verification", icon: "ShieldCheck" },
        { label: "Skill Tests", href: "/mentor/skill-tests", icon: "FileCheck2" },
        { label: "Badges & Ranking", href: "/mentor/badges", icon: "Award" },
        { label: "Promote Profile", href: "/mentor/promote", icon: "Rocket" },
      ],
    },
    {
      title: "Money",
      links: [
        { label: "Earnings", href: "/mentor/earnings", icon: "Wallet" },
        { label: "Payouts", href: "/mentor/payouts", icon: "Banknote" },
        { label: "Reviews", href: "/mentor/reviews", icon: "Star" },
        { label: "Notifications", href: "/mentor/notifications", icon: "Bell" },
      ],
    },
  ],
  guardian: [
    {
      links: [
        { label: "Dashboard", href: "/guardian", icon: "LayoutDashboard" },
        { label: "My Children", href: "/guardian/children", icon: "Users" },
        { label: "Orders", href: "/guardian/orders", icon: "ClipboardList" },
        { label: "Payments", href: "/guardian/payments", icon: "CreditCard" },
        { label: "Notifications", href: "/guardian/notifications", icon: "Bell" },
        { label: "Privacy & Permissions", href: "/guardian/privacy", icon: "ShieldCheck" },
      ],
    },
  ],
  admin: [
    {
      links: [
        { label: "Dashboard", href: "/admin", icon: "LayoutDashboard" },
        { label: "Orders", href: "/admin/orders", icon: "ClipboardList" },
        { label: "Disputes", href: "/admin/disputes", icon: "Scale", badge: 1 },
        { label: "Moderation", href: "/admin/moderation", icon: "Flag" },
      ],
    },
    {
      title: "People",
      links: [
        { label: "Users", href: "/admin/users", icon: "Users" },
        { label: "Mentor Applications", href: "/admin/mentors", icon: "UserCheck", badge: 3 },
        { label: "Verification Queue", href: "/admin/verification", icon: "ShieldCheck" },
        { label: "Students", href: "/admin/students", icon: "GraduationCap" },
        { label: "Staff", href: "/admin/staff", icon: "Briefcase", superOnly: true },
        { label: "Roles & Permissions", href: "/admin/roles", icon: "KeyRound", superOnly: true },
      ],
    },
    {
      title: "Finance",
      links: [
        { label: "Payments", href: "/admin/payments", icon: "CreditCard" },
        { label: "Payouts", href: "/admin/payouts", icon: "Banknote" },
        { label: "Refunds", href: "/admin/refunds", icon: "Undo2" },
        { label: "Coupons", href: "/admin/coupons", icon: "TicketPercent" },
        { label: "Referrals", href: "/admin/referrals", icon: "Gift" },
        { label: "Boosts & Subscriptions", href: "/admin/boosts", icon: "Rocket" },
      ],
    },
    {
      title: "Content",
      links: [
        { label: "Catalog", href: "/admin/catalog", icon: "BookOpen" },
        { label: "Homepage Banners", href: "/admin/banners", icon: "GalleryHorizontal" },
        { label: "Pages (CMS)", href: "/admin/pages", icon: "FileText" },
        { label: "Blog", href: "/admin/blog", icon: "Newspaper" },
        { label: "Reviews", href: "/admin/reviews", icon: "Star" },
        { label: "Advertising", href: "/admin/ads", icon: "Megaphone" },
        { label: "Website Messages", href: "/admin/messages", icon: "Mail" },
        { label: "Notifications", href: "/admin/notifications", icon: "Bell" },
        { label: "Rewards", href: "/admin/rewards", icon: "Trophy" },
      ],
    },
    {
      title: "System",
      links: [
        { label: "Settings", href: "/admin/settings", icon: "Settings", superOnly: true },
        { label: "Audit Log", href: "/admin/audit", icon: "ScrollText", superOnly: true },
        { label: "Security", href: "/admin/security", icon: "ShieldAlert", superOnly: true },
      ],
    },
  ],
  accountant: [
    {
      links: [
        { label: "Dashboard", href: "/accountant", icon: "LayoutDashboard" },
        {
          label: "Payment Verification",
          href: "/accountant/payments",
          icon: "BadgeCheck",
          badge: 3,
        },
        { label: "Mentor Earnings", href: "/accountant/earnings", icon: "Wallet" },
        { label: "Payout Requests", href: "/accountant/payouts", icon: "Banknote", badge: 2 },
        { label: "Refunds", href: "/accountant/refunds", icon: "Undo2" },
      ],
    },
    {
      title: "Books",
      links: [
        { label: "Ledger", href: "/accountant/ledger", icon: "BookText" },
        { label: "Commission", href: "/accountant/commission", icon: "Percent" },
        { label: "Reports", href: "/accountant/reports", icon: "ChartColumn" },
        { label: "Invoices & Export", href: "/accountant/invoices", icon: "FileDown" },
        { label: "Audit History", href: "/accountant/audit", icon: "ScrollText" },
      ],
    },
  ],
  "support-desk": [
    {
      links: [
        { label: "Dashboard", href: "/support-desk", icon: "LayoutDashboard" },
        { label: "Tickets", href: "/support-desk/tickets", icon: "Ticket", badge: 2 },
        { label: "Complaints", href: "/support-desk/complaints", icon: "MessageSquareWarning" },
        { label: "Escalations", href: "/support-desk/escalations", icon: "ArrowUpCircle" },
        { label: "Live Chat", href: "/support-desk/chat", icon: "MessageSquare" },
      ],
    },
    {
      title: "Lookup (read-only)",
      links: [
        { label: "Order Lookup", href: "/support-desk/orders", icon: "ClipboardList" },
        { label: "Payment Lookup", href: "/support-desk/payments", icon: "CreditCard" },
        { label: "Resolution History", href: "/support-desk/history", icon: "History" },
      ],
    },
  ],
};
