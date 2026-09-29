import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/config";
import { getServerDemoDataset } from "@/lib/demo/dataset";

// Starting state for the browser-side demo store (lib/live/local.ts).
export async function GET() {
  if (!isDemoMode) return NextResponse.json({ error: "Demo mode is off" }, { status: 404 });
  return NextResponse.json(getServerDemoDataset(), { headers: { "Cache-Control": "no-store" } });
}
