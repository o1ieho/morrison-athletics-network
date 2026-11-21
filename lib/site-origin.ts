import { headers } from "next/headers";

/** This request's origin ("https://morrison-athletics-network.vercel.app"), for links that leave the site (calendar apps). */
export async function siteOrigin() {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
