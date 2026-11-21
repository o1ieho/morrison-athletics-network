import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperatorConsole } from "@/components/operator/console";
import { requireStaff } from "@/lib/auth";
import Link from "next/link";
import { getData } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { canOperateGame, OPERATOR_WINDOW_HOURS } from "@/lib/operator-window";
import "../operator.css";

export const metadata: Metadata = { title: "Operator console" };

export default async function OperatorGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  const user = await requireStaff("operate", `/operator/${gameId}`);
  const data = await getData();
  const game = await data.getGame(gameId);
  if (!game) notFound();
  // The database refuses changes outside game day anyway; say so up front instead of failing on the first tap.
  if (!canOperateGame(game, user)) {
    return (
      <main className="op-picker">
        <div className="op-picker-inner">
          <p className="eyebrow">Live operator</p>
          <h1>{Date.parse(game.startsAt) > Date.now() ? "Not open yet" : "Game locked"}</h1>
          <p style={{ color: "#97a39c" }}>
            Broncos {game.isHome ? "vs" : "at"} {game.opponent.shortName}, {formatDateTime(game.startsAt)}. Stat operators can run a
            game from {OPERATOR_WINDOW_HOURS} hours before tip-off until {OPERATOR_WINDOW_HOURS} hours after. To correct an older game,
            ask an admin.
          </p>
          <Link href="/operator" style={{ color: "#6fcf97" }}>
            ← All games
          </Link>
        </div>
      </main>
    );
  }
  const [events, roster] = await Promise.all([data.getGameEvents(gameId), data.getRoster(game.teamId)]);
  return <OperatorConsole initial={{ game, events, roster }} />;
}
