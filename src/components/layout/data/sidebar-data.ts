import {
  LayoutDashboard,
  Settings,
  Users,
  UserCog,
  Bolt,
  Palette,
  Lock,
  CheckCircle,
  MapPin,
  Home,
  BookUser,
  CreditCard,
  Building2,
  FlagTriangleRight,
  Logs,
  Receipt,
  ScanSearch,
  List,
  SquarePen,
} from "lucide-react";
import { type SidebarData } from "../types";

export const sidebarData: SidebarData = {
  user: {
    name: "satnaing",
    email: "satnaingdev@gmail.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [],
  navGroups: [
    {
      title: "General",
      items: [
        {
          title: "Dashboard",
          url: "/",
          icon: LayoutDashboard,
          requiredPermission: { resource: "/", action: "read" },
        },
        {
          title: "Directory",
          url: "/directory",
          icon: BookUser,
          requiredPermission: { resource: "/directory", action: "read" },
        },
        {
          title: "Tenants",
          url: "/tenants",
          icon: Building2,
          requiredPermission: { resource: "/tenants", action: "read" },
        },
        {
          title: "Check In",
          icon: MapPin,
          items: [
            {
              title: "Check In",
              url: "/check-in",
              icon: MapPin,
              requiredPermission: { resource: "/check-in", action: "create" },
            },
            {
              title: "View Logs",
              url: "/check-in/logs",
              icon: Logs,
              requiredPermission: { resource: "/check-in-logs", action: "read" },
            },
            {
              title: "Checkpoints",
              url: "/check-in/checkpoints",
              icon: FlagTriangleRight,
              requiredPermission: { resource: "/checkpoints", action: "read" },
            },
            {
              title: "Configuration",
              url: "/check-in/configuration",
              icon: Bolt,
              requiredPermission: { resource: "/check-in", action: "read" },
            },
          ],
        },
        {
          title: "Financial",
          icon: CreditCard,
          requiredPermission: { resource: "/billing", action: "read" },
          items: [
            {
              title: "Billing",
              url: "/billing",
              icon: Receipt,
              requiredPermission: { resource: "/billing", action: "read" },
            },
            {
              title: "Payment Review",
              url: "/billing/review",
              icon: ScanSearch,
              requiredPermission: { resource: "/billing", action: "read" },
            },
            {
              title: "Settings",
              url: "/billing/settings",
              icon: Bolt,
              requiredPermission: { resource: "/settings", action: "read" },
            },
          ],
        },
        {
          title: "Homestay",
          icon: Home,
          requiredPermission: { resource: "/homestay", action: "read" },
          items: [
            {
              title: "Listing",
              url: "/homestay/listing",
              icon: List,
              requiredPermission: { resource: "/homestay", action: "read" },
            },
            {
              title: "Record",
              url: "/homestay/record",
              icon: SquarePen,
              requiredPermission: { resource: "/homestay-record", action: "read" },
            },
          ],
        },

        {
          title: "Authentication",
          icon: Lock,
          items: [
            {
              title: "Users",
              url: "/auth/users",
              icon: Users,
              requiredPermission: { resource: "/users", action: "read" },
            },
            {
              title: "Roles",
              url: "/auth/roles",
              icon: CheckCircle,
              requiredPermission: { resource: "/roles", action: "read" },
            },
          ],
        },
        {
          title: "Settings",
          icon: Settings,
          items: [
            {
              title: "Profile",
              url: "/settings",
              icon: UserCog,
              requiredPermission: { resource: "/settings", action: "read" },
            },
            {
              title: "Change Password",
              url: "/settings/change-password",
              icon: Lock,
              requiredPermission: { resource: "/settings", action: "read" },
            },
            {
              title: "Appearance",
              url: "/settings/appearance",
              icon: Palette,
              requiredPermission: { resource: "/settings", action: "read" },
            },
          ],
        },
      ],
    },
  ],
};
