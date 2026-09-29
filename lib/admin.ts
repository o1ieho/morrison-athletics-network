import { announcements, athletes, coaches, games, mediaAssets, teams } from "@/lib/data";

export const adminSections = [
  {
    href: "/admin/announcements",
    label: "Announcements",
    count: announcements.length,
    description: "Publish live department updates, game-day notices, cancellations, and pinned messages.",
    priority: "Daily",
  },
  {
    href: "/admin/games",
    label: "Games & Schedule",
    count: games.length,
    description: "Add games on the fly, change times/locations, mark finals, postponements, and live status.",
    priority: "Game week",
  },
  {
    href: "/admin/teams",
    label: "Teams",
    count: teams.length,
    description: "Manage sport, level, season state, team identity, records, and public team pages.",
    priority: "Season setup",
  },
  {
    href: "/admin/athletes",
    label: "Rosters & Athletes",
    count: athletes.length,
    description: "Keep minimal athlete profiles current after tryouts and roster changes.",
    priority: "Tryouts",
  },
  {
    href: "/admin/coaches",
    label: "Coaches",
    count: coaches.length,
    description: "Team-linked coach profiles and placeholder staff blocks until confirmed.",
    priority: "Season setup",
  },
  {
    href: "/admin/media",
    label: "Media",
    count: mediaAssets.length,
    description: "Highlights, photo galleries, livestream embeds, and featured assets.",
    priority: "As available",
  },
  {
    href: "/admin/standings",
    label: "Standings",
    count: 1,
    description: "Manual TISSA standings, records, notes, and public table overrides.",
    priority: "Weekly",
  },
];

export const adminPlaybook = [
  "Post announcements as soon as schedule or transportation changes happen.",
  "Keep upcoming games editable until tipoff, kickoff, or meet start.",
  "Mark teams as upcoming, active, complete, or no JV this season.",
  "Use minimal athlete profiles first: name, grade, number, position, team.",
  "Treat media as optional but structured: highlights, galleries, embeds, and featured photos.",
];
