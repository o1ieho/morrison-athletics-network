import { getData } from "@/lib/data";
import { gamesCalendar } from "@/lib/ics";

/** One game as an .ics file, for the "Add to calendar" button (Apple Calendar, Outlook, most Android calendars). */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await (await getData()).getGame(id);
  if (!game) return new Response("Not found", { status: 404 });
  const body = gamesCalendar([game], { siteUrl: new URL(request.url).origin, name: "Broncos Basketball" });
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="broncos-${game.id}.ics"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
