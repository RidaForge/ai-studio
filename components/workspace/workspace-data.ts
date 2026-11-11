import {
  AudioLines,
  Clapperboard,
  FolderOpen,
  UserRound,
  Video,
  type LucideIcon,
} from "lucide-react";

export type WorkspaceDestination = {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const workspaceDestinations: WorkspaceDestination[] = [
  {
    slug: "ai-video-agent",
    label: "AI Video Agent",
    description: "Turn a simple idea into a complete, ready-to-share video.",
    icon: Clapperboard,
  },
  {
    slug: "ai-video-avatar",
    label: "AI Video Avatar",
    description: "Create polished presenter videos with an AI avatar.",
    icon: Video,
  },
  {
    slug: "avatar",
    label: "Avatar",
    description: "Build a digital presence that looks and feels like you.",
    icon: UserRound,
  },
  {
    slug: "ai-voice-cloning",
    label: "AI Voice Cloning",
    description: "Create a natural voice model from a short recording.",
    icon: AudioLines,
  },
];

export const libraryDestination: WorkspaceDestination = {
  slug: "my-library",
  label: "My Library",
  description: "Find your saved videos, avatars, and voice projects in one place.",
  icon: FolderOpen,
};

export const allDestinations = [...workspaceDestinations, libraryDestination];

export const navigationItems = [
  { label: "Home", href: "/", icon: null },
  ...allDestinations.map((item) => ({ label: item.label, href: `/${item.slug}`, icon: item.icon })),
];
