import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { GameCenter } from "@/components/game-center";
import { getData } from "@/lib/data";
import { teamLabel } from "@/lib/format";
import { googleCalendarEventUrl } from "@/lib/ics";
import { shareImagePath, shareSummary, shareTitle } from "@/lib/share";
import { siteOrigin } from "@/lib/site-origin";
import { parseGameTab } from "@/lib/game-tabs";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = await (await getData()).getGame(id);
  if (!game) return { title: "Game" };
  // What a shared link shows in LINE, WhatsApp or iMessage: the score, not just the matchup.
  const title = shareTitle(game);
  const description = shareSummary(game);
  const image = { url: shareImagePath(game), width: 1200, height: 630, alt: description };
  return {
    title,
    description,
    openGraph: { title: description, description: `${title} · MAT Athletics`, images: [image], type: "website" },
    twitter: { card: "summary_large_image", title: description, images: [image] },
  };
}

export default async function GamePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;
  const data = await getData();
  const game = await data.getGame(id);
  if (!game) notFound();
  // An upcoming game's page also shows season leaders, form and the last meeting.
  const upcoming = game.status === "scheduled" || game.status === "postponed";
  const [events, roster, preview, origin] = await Promise.all([
    data.getGameEvents(id),
    data.getRoster(game.teamId),
    upcoming
      ? Promise.all([data.getSeasonStats(game.teamId), data.getGames({ teamId: game.teamId })]).then(([stats, games]) => ({ stats, games }))
      : undefined,
    siteOrigin(),
  ]);
  const calendar = upcoming ? { ics: `/games/${encodeURIComponent(id)}/calendar.ics`, google: googleCalendarEventUrl(game, origin) } : undefined;

  return (
    <main className="page">
      <div className="container stack">
        <Link href={`/teams/${game.team.slug}`} className="muted small" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={16} /> {teamLabel(game.team)} schedule
        </Link>
        <GameCenter initial={{ game, events, roster }} preview={preview} calendar={calendar} initialTab={parseGameTab(tab)} />
      </div>
    </main>
  );
}
