/** The game page's tabs, in order, with their labels. The id is what ?tab= holds. */
export type GameTab = "gamecast" | "box" | "plays" | "stats";

export const GAME_TABS: ReadonlyArray<readonly [GameTab, string]> = [
  ["gamecast", "Gamecast"],
  ["box", "Box Score"],
  ["plays", "Play-by-Play"],
  ["stats", "Team Stats"],
];

/** Reads ?tab= (a #play-… link means the play-by-play). Gamecast when absent or unknown. */
export function parseGameTab(tab: string | string[] | undefined | null, hash = ""): GameTab {
  if (hash.startsWith("#play-")) return "plays";
  const value = Array.isArray(tab) ? tab[0] : tab;
  return GAME_TABS.some(([id]) => id === value) ? (value as GameTab) : "gamecast";
}
