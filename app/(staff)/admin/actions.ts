"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaffUser } from "@/lib/auth";
import { isDemoMode } from "@/lib/config";
import { taipeiLocalToIso } from "@/lib/format";
import { createSessionClient } from "@/lib/supabase/server";

/** `at` changes on every success so forms can reset themselves. */
export type ActionResult = { ok?: string; error?: string; at?: number };

// Every action re-checks the role here for a clear error message; the
// database's row-level security is the real guarantee.
async function adminClient() {
  if (isDemoMode) throw new Error("Editing is turned off in demo mode. Connect Supabase to manage real data.");
  const user = await getStaffUser();
  if (!user?.isAdmin) throw new Error("Only admins can make changes.");
  return createSessionClient();
}

async function run(work: () => Promise<string | void>): Promise<ActionResult> {
  try {
    const message = await work();
    revalidatePath("/", "layout");
    return { ok: message || "Saved", at: Date.now() };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error; // let redirect() through
    return { error: error instanceof Error ? error.message : "Something went wrong" };
  }
}

function check<T>(schema: z.ZodType<T>, form: FormData): T {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${issue.path.join(".") || "Form"}: ${issue.message}`);
  }
  return parsed.data;
}

function fail(error: { message: string; code?: string } | null, what: string): never {
  if (error?.code === "23505") throw new Error(`${what}: that already exists (duplicate).`);
  throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

// ---------------------------------------------------------------- Games

const gameSchema = z.object({
  id: z.string().optional(),
  team_id: z.string().min(1, "choose a team"),
  opponent_id: z.string().min(1, "choose an opponent"),
  is_home: z.enum(["home", "away"]),
  starts_at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "enter a date and time"),
  location: z.string().trim().max(120),
  status: z.enum(["scheduled", "live", "final", "postponed", "canceled"]),
  scoring_mode: z.enum(["live", "manual"]),
  team_score: z.coerce.number().int().min(0).max(300).optional(),
  opponent_score: z.coerce.number().int().min(0).max(300).optional(),
  period_length_minutes: z.coerce.number().int().min(1).max(20),
  foul_reset: z.enum(["quarter", "half"]),
  bonus_threshold: z.coerce.number().int().min(1).max(10),
});

export async function saveGame(_: ActionResult, form: FormData): Promise<ActionResult> {
  const created = { id: "" };
  const result = await run(async () => {
    const input = check(gameSchema, form);
    const db = await adminClient();
    const { data: season } = await db.from("seasons").select("id").eq("is_active", true).single();
    if (!season) throw new Error("No active season. Run supabase/seed.sql first.");

    const row: Record<string, unknown> = {
      team_id: input.team_id,
      opponent_id: input.opponent_id,
      is_home: input.is_home === "home",
      starts_at: taipeiLocalToIso(input.starts_at),
      location: input.location,
      status: input.status,
      scoring_mode: input.scoring_mode,
      period_length_seconds: input.period_length_minutes * 60,
      foul_reset: input.foul_reset,
      bonus_threshold: input.bonus_threshold,
    };
    if (input.scoring_mode === "manual") {
      row.team_score = input.team_score ?? 0;
      row.opponent_score = input.opponent_score ?? 0;
    }

    if (input.id) {
      const { error } = await db.from("games").update(row).eq("id", input.id);
      if (error) fail(error, "Saving the game");
      return "Game saved";
    }
    const { data, error } = await db
      .from("games")
      .insert({ ...row, season_id: season.id, clock_seconds_left: input.period_length_minutes * 60 })
      .select("id")
      .single();
    if (error || !data) fail(error, "Adding the game");
    created.id = data.id;
  });
  if (created.id) redirect(`/admin/games/${created.id}?created=1`);
  return result;
}

export async function deleteGame(form: FormData) {
  const id = String(form.get("id") ?? "");
  const db = await adminClient();
  const { error } = await db.from("games").delete().eq("id", id);
  if (error) fail(error, "Deleting the game");
  revalidatePath("/", "layout");
  redirect("/admin/games");
}

// ---------------------------------------------------------------- Opponents

const opponentSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "enter the school or team name").max(80),
  short_name: z.string().trim().min(1, "enter a short name").max(24),
});

export async function saveOpponent(_: ActionResult, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = check(opponentSchema, form);
    const db = await adminClient();
    if (input.id) {
      const { error } = await db.from("opponents").update({ name: input.name, short_name: input.short_name }).eq("id", input.id);
      if (error) fail(error, "Saving the opponent");
      return "Opponent saved";
    }
    const { error } = await db.from("opponents").insert({ id: slugify(input.name), name: input.name, short_name: input.short_name });
    if (error) fail(error, "Adding the opponent");
    return `Added ${input.name}`;
  });
}

// ---------------------------------------------------------------- Roster

const playerSchema = z.object({
  athlete_id: z.string().optional(),
  team_id: z.string().min(1),
  full_name: z.string().trim().min(2, "enter the player's name").max(80),
  jersey_number: z.union([z.literal(""), z.coerce.number().int().min(0).max(99)]),
  position: z.string().trim().max(12),
  height: z.string().trim().max(12),
  grade: z.string().trim().max(4),
});

export async function savePlayer(_: ActionResult, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = check(playerSchema, form);
    const db = await adminClient();
    const { data: season } = await db.from("seasons").select("id").eq("is_active", true).single();
    if (!season) throw new Error("No active season.");

    let athleteId = input.athlete_id;
    if (athleteId) {
      const { error } = await db.from("athletes").update({ full_name: input.full_name }).eq("id", athleteId);
      if (error) fail(error, "Saving the player");
    } else {
      let slug = slugify(input.full_name);
      const { data: taken } = await db.from("athletes").select("id").eq("slug", slug).maybeSingle();
      if (taken) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      const { data, error } = await db.from("athletes").insert({ id: slug, slug, full_name: input.full_name }).select("id").single();
      if (error || !data) fail(error, "Adding the player");
      athleteId = data.id;
    }

    const { error } = await db.from("athlete_seasons").upsert({
      athlete_id: athleteId,
      season_id: season.id,
      team_id: input.team_id,
      jersey_number: input.jersey_number === "" ? null : input.jersey_number,
      position: input.position || null,
      height: input.height || null,
      grade: input.grade || null,
    });
    if (error?.code === "23505") throw new Error(`Jersey #${input.jersey_number} is already taken on this team.`);
    if (error) fail(error, "Saving the roster spot");
    return input.athlete_id ? `Saved ${input.full_name}` : `Added ${input.full_name}`;
  });
}

export async function removePlayer(form: FormData) {
  const athleteId = String(form.get("athlete_id") ?? "");
  const teamId = String(form.get("team_id") ?? "");
  const db = await adminClient();
  const { data: season } = await db.from("seasons").select("id").eq("is_active", true).single();
  // Removes the roster spot only; past stats keep pointing at the athlete.
  const { error } = await db.from("athlete_seasons").delete().match({ athlete_id: athleteId, team_id: teamId, season_id: season?.id });
  if (error) fail(error, "Removing the player");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- News

const newsSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(3, "enter a title").max(140),
  category: z.enum(["game-day", "team-news", "transportation", "achievement", "department"]),
  summary: z.string().trim().max(300),
  body: z.string().trim().max(10000),
  team_id: z.string().optional(),
  pinned: z.string().optional(),
  publish: z.string().optional(),
});

export async function saveAnnouncement(_: ActionResult, form: FormData): Promise<ActionResult> {
  return run(async () => {
    const input = check(newsSchema, form);
    const db = await adminClient();
    const row = {
      title: input.title,
      category: input.category,
      summary: input.summary,
      body: input.body,
      team_id: input.team_id || null,
      pinned: input.pinned === "on",
      published_at: input.publish === "on" ? new Date().toISOString() : null,
    };
    if (input.id) {
      // Keep the original publish time when editing a published post.
      const { data: existing } = await db.from("announcements").select("published_at").eq("id", input.id).single();
      const published_at = input.publish === "on" ? (existing?.published_at ?? row.published_at) : null;
      const { error } = await db.from("announcements").update({ ...row, published_at }).eq("id", input.id);
      if (error) fail(error, "Saving the post");
      return "Post saved";
    }
    const slug = `${slugify(input.title).slice(0, 60)}-${Date.now().toString(36)}`;
    const { error } = await db.from("announcements").insert({ ...row, slug });
    if (error) fail(error, "Adding the post");
    return input.publish === "on" ? "Published" : "Saved as draft";
  });
}

export async function deleteAnnouncement(form: FormData) {
  const db = await adminClient();
  const { error } = await db.from("announcements").delete().eq("id", String(form.get("id") ?? ""));
  if (error) fail(error, "Deleting the post");
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- Media

export async function deleteMedia(form: FormData) {
  const db = await adminClient();
  const id = String(form.get("id") ?? "");
  const { data: item, error: readError } = await db.from("media").select("storage_paths").eq("id", id).single();
  if (readError) fail(readError, "Finding the media item");
  const paths = (item?.storage_paths as string[] | null) ?? [];
  if (paths.length) {
    const { error } = await db.storage.from("media").remove(paths);
    if (error) throw new Error(`Deleting the files: ${error.message}`);
  }
  const { error } = await db.from("media").delete().eq("id", id);
  if (error) fail(error, "Deleting the media item");
  revalidatePath("/", "layout");
}
