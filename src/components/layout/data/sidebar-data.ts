import { LayoutDashboard, Settings, Users, Command, UserCog, Palette, Lock, CheckCircle, MapPin, Home, BookUser, CreditCard } from "lucide-react";
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
          title: "Billing",
          url: "/billing",
          icon: CreditCard,
          requiredPermission: { resource: "/billing", action: "read" },
        },
        {
          title: "Payment Review",
          url: "/billing/review",
          icon: CheckCircle,
          requiredPermission: { resource: "/billing", action: "read" },
        },
        {
          title: "Users",
          url: "/users",
          icon: Users,
          requiredPermission: { resource: "/users", action: "read" },
        },

        {
          title: "Homestay",
          icon: Home,
          requiredPermission: { resource: "/homestay", action: "read" },
          items: [
            {
              title: "Homestay Listing",
              url: "/homestay",
              requiredPermission: { resource: "/homestay", action: "read" },
            },
            {
              title: "Homestay Record",
              url: "/homestay-record",
              requiredPermission: { resource: "/homestay-record", action: "read" },
            },
          ],
        },
        {
          title: "Check In",
          icon: MapPin,
          items: [
            {
              title: "Check In",
              url: "/check-in",
              requiredPermission: { resource: "/check-in", action: "create" },
            },
            {
              title: "View Logs",
              url: "/check-in-logs",
              requiredPermission: { resource: "/check-in-logs", action: "read" },
            },
            {
              title: "Checkpoints",
              url: "/checkpoints",
              requiredPermission: { resource: "/checkpoints", action: "read" },
            },
            {
              title: "Configuration",
              url: "/settings/check-in",
              requiredPermission: { resource: "/settings/check-in", action: "read" },
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
            {
              title: "Billing",
              url: "/settings/billing",
              requiredPermission: { resource: "/settings", action: "read" },
            },
          ],
        },

        {
          title: "Roles",
          url: "/roles",
          icon: CheckCircle,
          requiredPermission: { resource: "/roles", action: "read" },
        },
      ],
    },
  ],
};
