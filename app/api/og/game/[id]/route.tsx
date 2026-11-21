import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { periodLabel } from "@/lib/basketball";
import { getData } from "@/lib/data";
import { formatDateTime, teamLabel } from "@/lib/format";

const SIZE = { width: 1200, height: 630 };
const BRAND = "#455a4d";
const INK = "#0d1411";
const YELLOW = "#f2c94c";

/** The site's heading font, fetched once per server instance; the default font if Google Fonts can't be reached. */
let anton: Promise<ArrayBuffer | null> | null = null;
function loadAnton() {
  anton ??= fetch("https://fonts.googleapis.com/css2?family=Anton")
    .then((response) => response.text())
    .then((css) => {
      const url = css.match(/src: url\((.+?)\) format/)?.[1];
      return url ? fetch(url).then((response) => response.arrayBuffer()) : null;
    })
    .catch(() => null);
  return anton;
}

let logo: Promise<string> | null = null;
function loadLogo() {
  logo ??= readFile(join(process.cwd(), "public/brand/broncos-head-cropped.png")).then(
    (file) => `data:image/png;base64,${file.toString("base64")}`,
  );
  return logo;
}

/**
 * The preview card for a shared game link: the score and status, big enough
 * to read in a chat thumbnail. The address carries ?v=<score>, so each score
 * gets its own cacheable image (see lib/share.ts).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const game = await (await getData()).getGame(id);
  if (!game) return new Response("Not found", { status: 404 });
  const [font, logoSrc] = await Promise.all([loadAnton(), loadLogo()]);

  const started = game.status === "live" || game.status === "final";
  const status =
    game.status === "live"
      ? `LIVE · ${periodLabel(game.currentPeriod, game.periodCount)}`
      : game.status === "final"
        ? "FINAL"
        : game.status === "postponed"
          ? "POSTPONED"
          : game.status === "canceled"
            ? "CANCELED"
            : formatDateTime(game.startsAt).toUpperCase();
  const heading = font ? "Anton" : undefined;
  const side = (name: string, score: number, won: boolean) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: 420 }}>
      <div style={{ display: "flex", fontFamily: heading, fontSize: 64, textTransform: "uppercase", color: "white", lineHeight: 1 }}>{name}</div>
      {started && (
        <div style={{ display: "flex", fontFamily: heading, fontSize: 200, lineHeight: 1, color: won || game.status === "live" ? "white" : "rgba(255,255,255,0.55)" }}>
          {score}
        </div>
      )}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BRAND, color: "white", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "32px 48px", background: INK }}>
          <img src={logoSrc} width={64} height={64} alt="" />
          <div style={{ display: "flex", fontFamily: heading, fontSize: 40, textTransform: "uppercase" }}>MAT Athletics</div>
          <div style={{ display: "flex", marginLeft: "auto", fontSize: 30, color: "rgba(255,255,255,0.75)" }}>{`${teamLabel(game.team)} Basketball`}</div>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
          {side("Broncos", game.teamScore, game.teamScore > game.opponentScore)}
          <div
            style={{
              display: "flex",
              padding: "10px 22px",
              background: game.status === "live" ? "#d92d20" : INK,
              color: game.status === "live" ? "white" : YELLOW,
              fontFamily: heading,
              fontSize: started ? 40 : 34,
              textTransform: "uppercase",
            }}
          >
            {started ? status : game.isHome ? "vs" : "at"}
          </div>
          {side(game.opponent.shortName, game.opponentScore, game.opponentScore > game.teamScore)}
        </div>
        {!started && (
          <div style={{ display: "flex", justifyContent: "center", paddingBottom: 56, fontSize: 40, color: YELLOW, fontFamily: heading }}>{status}</div>
        )}
      </div>
    ),
    {
      ...SIZE,
      fonts: font ? [{ name: "Anton", data: font, weight: 400, style: "normal" }] : undefined,
      // A minute is fresh enough: a new score gets a new address anyway.
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    },
  );
}
