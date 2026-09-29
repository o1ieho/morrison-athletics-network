import { computeBoxScore } from "@/lib/basketball";
import { getServerDemoDataset } from "@/lib/demo/dataset";
import type { GameSummary, SeasonStatLine, StatLine } from "@/lib/types";
import type { DataSource } from "./source";

const dataset = getServerDemoDataset();

function summaries(): GameSummary[] {
  return dataset.games
    .map((game) => ({
      ...game,
      team: dataset.teams.find((team) => team.id === game.teamId)!,
      opponent: dataset.opponents.find((opponent) => opponent.id === game.opponentId)!,
    }))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

function playerLines(gameId: string) {
  const game = dataset.games.find((entry) => entry.id === gameId)!;
  const roster = dataset.roster.filter((player) => player.teamId === game.teamId);
  const events = dataset.events.filter((event) => event.gameId === gameId);
  // Only players who recorded something count as having played (matches the SQL view).
  const played = new Set(events.map((event) => event.athleteId).filter(Boolean));
  return computeBoxScore(events, roster).players.filter((row) => played.has(row.player.athleteId));
}

export function createDemoSource(): DataSource {
  return {
    async getSeason() {
      return dataset.season;
    },
    async getTeams() {
      return dataset.teams;
    },
    async getRoster(teamId) {
      return dataset.roster
        .filter((player) => !teamId || player.teamId === teamId)
        .sort((a, b) => (a.number ?? 999) - (b.number ?? 999));
    },
    async getGames(options) {
      return summaries().filter((game) => !options?.teamId || game.teamId === options.teamId);
    },
    async getGame(id) {
      return summaries().find((game) => game.id === id) ?? null;
    },
    async getGameEvents(gameId) {
      return dataset.events.filter((event) => event.gameId === gameId);
    },
    async getSeasonStats(teamId) {
      const totals = new Map<string, SeasonStatLine>();
      for (const game of dataset.games) {
        if (game.status !== "final" || (teamId && game.teamId !== teamId)) continue;
        for (const { player, line } of playerLines(game.id)) {
          const total = totals.get(player.athleteId) ?? { ...zero(), athleteId: player.athleteId, teamId: game.teamId, gp: 0 };
          for (const key of Object.keys(line) as Array<keyof StatLine>) total[key] += line[key];
          total.gp += 1;
          totals.set(player.athleteId, total);
        }
      }
      return [...totals.values()];
    },
    async getPlayerGameLog(athleteId) {
      return dataset.games.flatMap((game) =>
        playerLines(game.id)
          .filter((row) => row.player.athleteId === athleteId)
          .map((row) => ({ gameId: game.id, line: row.line })),
      );
    },
    async getTeamRecords() {
      return dataset.teams.map((team) => {
        const finals = dataset.games.filter((game) => game.teamId === team.id && game.status === "final");
        return {
          teamId: team.id,
          wins: finals.filter((game) => game.teamScore > game.opponentScore).length,
          losses: finals.filter((game) => game.teamScore < game.opponentScore).length,
          ties: finals.filter((game) => game.teamScore === game.opponentScore).length,
        };
      });
    },
    async getAnnouncements() {
      return [];
    },
    async getMedia() {
      return [];
    },
  };
}

function zero(): StatLine {
  return { pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0, oreb: 0, dreb: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 };
}
