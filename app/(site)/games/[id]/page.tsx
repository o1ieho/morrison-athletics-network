import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { GameCenter } from "@/components/game-center";
import { getData } from "@/lib/data";
import { matchupLabel, teamLabel } from "@/lib/format";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const game = await (await getData()).getGame(id);
  return { title: game ? `${matchupLabel(game)} (${teamLabel(game.team)})` : "Game" };
}

export default async function GamePage({ params }: Props) {
  const { id } = await params;
  const data = await getData();
  const game = await data.getGame(id);
  if (!game) notFound();
  const [events, roster] = await Promise.all([data.getGameEvents(id), data.getRoster(game.teamId)]);

  return (
    <main className="page">
      <div className="container stack">
        <Link href={`/teams/${game.team.slug}`} className="muted small" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={16} /> {teamLabel(game.team)} schedule
        </Link>
        <GameCenter initial={{ game, events, roster }} />
      </div>
    </main>
  );
}
