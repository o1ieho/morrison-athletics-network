import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OperatorConsole } from "@/components/operator/console";
import { requireStaff } from "@/lib/auth";
import { getData } from "@/lib/data";
import "../operator.css";

export const metadata: Metadata = { title: "Operator console" };

export default async function OperatorGamePage({ params }: { params: Promise<{ gameId: string }> }) {
  const { gameId } = await params;
  await requireStaff("operate", `/operator/${gameId}`);
  const data = await getData();
  const game = await data.getGame(gameId);
  if (!game) notFound();
  const [events, roster] = await Promise.all([data.getGameEvents(gameId), data.getRoster(game.teamId)]);
  return <OperatorConsole initial={{ game, events, roster }} />;
}
