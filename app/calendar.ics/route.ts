import { getData } from "@/lib/data";
import { gamesCalendar } from "@/lib/ics";
import { teamLabel } from "@/lib/format";

/**
 * The season's games as a calendar feed. Subscribe once (webcal://…/calendar.ics)
 * and new games, time changes and final scores appear on their own.
 * ?team=<team slug> limits it to one team.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const data = await getData();
  const slug = url.searchParams.get("team");
  const team = slug ? (await data.getTeams()).find((entry) => entry.slug === slug) : null;
  if (slug && !team) return new Response("Unknown team", { status: 404 });
  const games = await data.getGames(team ? { teamId: team.id } : undefined);
  const body = gamesCalendar(games, {
    siteUrl: url.origin,
    name: team ? `Broncos ${teamLabel(team)} Basketball` : "Broncos Basketball",
  });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
