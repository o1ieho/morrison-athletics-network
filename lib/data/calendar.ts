import { connection } from "next/server";
import { googleCalendarFeedUrl, parseCalendar, type CalendarEvent } from "@/lib/calendar";
import { googleCalendarId } from "@/lib/config";

export type Schedule =
  | { status: "not-configured" }
  | { status: "ok"; calendarId: string; events: CalendarEvent[] }
  | { status: "error"; calendarId: string; message: string };

const DAY_MS = 86_400_000;
const LOOKAHEAD_DAYS = 120;

/**
 * Upcoming events from the athletics Google Calendar. The feed is cached for
 * 5 minutes, so an edit on the AD's phone shows up on the site shortly after.
 */
export async function getSchedule(): Promise<Schedule> {
  await connection();
  if (!googleCalendarId) return { status: "not-configured" };

  try {
    const response = await fetch(googleCalendarFeedUrl(googleCalendarId), { next: { revalidate: 300 } });
    if (!response.ok) {
      const hint = response.status === 404 ? " (is the calendar set to public?)" : "";
      return { status: "error", calendarId: googleCalendarId, message: `Google Calendar returned ${response.status}${hint}` };
    }
    // Start from midnight Taipei today, so today's earlier events still show.
    const now = new Date();
    const todayTaipei = new Date(Math.floor((now.getTime() + 8 * 3600_000) / DAY_MS) * DAY_MS - 8 * 3600_000);
    const events = parseCalendar(await response.text(), todayTaipei, new Date(todayTaipei.getTime() + LOOKAHEAD_DAYS * DAY_MS));
    return { status: "ok", calendarId: googleCalendarId, events };
  } catch (error) {
    return { status: "error", calendarId: googleCalendarId, message: error instanceof Error ? error.message : "Could not reach Google Calendar" };
  }
}
