// Reads the athletics Google Calendar's public iCal feed into simple events
// for the schedule page. Pure functions (no fetch) so they can be tested.

import ICAL from "ical.js";

export type CalendarEvent = {
  /** Unique per occurrence (repeating events share a UID). */
  id: string;
  title: string;
  /** ISO timestamp, or YYYY-MM-DD for all-day events. */
  start: string;
  end: string | null;
  allDay: boolean;
  location: string;
  description: string;
};

const TAIPEI_OFFSET = "+08:00";
const MAX_OCCURRENCES_PER_EVENT = 400;

type IcalTime = InstanceType<typeof ICAL.Time>;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateOnly(time: IcalTime) {
  return `${time.year}-${pad(time.month)}-${pad(time.day)}`;
}

/**
 * Converts an iCal time to ISO. Times with a known zone (or UTC) convert
 * exactly; floating times and unknown zones are read as Taipei time, which is
 * what a school calendar in Taiwan means.
 */
function toIso(time: IcalTime): string {
  if (time.isDate) return dateOnly(time);
  const tzid = time.zone?.tzid;
  const known = tzid === "UTC" || (tzid && tzid !== "floating" && ICAL.TimezoneService.has(tzid));
  if (known) return time.toJSDate().toISOString();
  return new Date(`${dateOnly(time)}T${pad(time.hour)}:${pad(time.minute)}:${pad(time.second)}${TAIPEI_OFFSET}`).toISOString();
}

/** Start of an event as epoch ms (all-day events start at Taipei midnight). */
export function startMs(event: Pick<CalendarEvent, "start" | "allDay">) {
  return event.allDay ? Date.parse(`${event.start}T00:00:00${TAIPEI_OFFSET}`) : Date.parse(event.start);
}

function endMs(event: Pick<CalendarEvent, "start" | "end" | "allDay">) {
  if (!event.end) return startMs(event);
  return event.allDay ? Date.parse(`${event.end}T00:00:00${TAIPEI_OFFSET}`) : Date.parse(event.end);
}

function clean(text: string | null | undefined) {
  return (text ?? "").replace(/\s+\n/g, "\n").trim();
}

/**
 * Parses an iCal feed and returns the events overlapping [from, to), sorted by
 * start. Repeating events are expanded, edited or cancelled single occurrences
 * are respected, and cancelled events are dropped.
 */
export function parseCalendar(ics: string, from: Date, to: Date): CalendarEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics));

  for (const zone of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(zone);
  }

  // Group by UID so edits to single occurrences attach to their series.
  const byUid = new Map<string, { main?: InstanceType<typeof ICAL.Event>; exceptions: InstanceType<typeof ICAL.Event>[] }>();
  for (const component of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(component);
    const group = byUid.get(event.uid) ?? { exceptions: [] };
    if (event.isRecurrenceException()) group.exceptions.push(event);
    else group.main = event;
    byUid.set(event.uid, group);
  }

  const fromMs = from.getTime();
  const toMs = to.getTime();
  const events: CalendarEvent[] = [];

  const add = (
    source: InstanceType<typeof ICAL.Event>,
    start: IcalTime,
    end: IcalTime | null,
    id: string,
  ) => {
    const status = String(source.component.getFirstPropertyValue("status") ?? "").toUpperCase();
    if (status === "CANCELLED") return;
    const event: CalendarEvent = {
      id,
      title: clean(source.summary) || "Untitled event",
      start: toIso(start),
      end: end ? toIso(end) : null,
      allDay: start.isDate,
      location: clean(source.location),
      description: clean(source.description),
    };
    // Keep anything that overlaps the window, e.g. a tournament that started
    // yesterday. Ends are exclusive: an all-day event on the 28th ends at
    // midnight on the 29th, so it's gone by the 29th.
    const stillOn = event.end ? endMs(event) > fromMs : startMs(event) >= fromMs;
    if (stillOn && startMs(event) < toMs) events.push(event);
  };

  for (const [uid, { main, exceptions }] of byUid) {
    if (!main) {
      // A moved occurrence whose series isn't in the feed: show it as-is.
      for (const exception of exceptions) add(exception, exception.startDate, exception.endDate, `${uid}:${toIso(exception.startDate)}`);
      continue;
    }
    if (!main.isRecurring()) {
      add(main, main.startDate, main.endDate, uid);
      continue;
    }

    for (const exception of exceptions) main.relateException(exception);
    const iterator = main.iterator();
    for (let count = 0, next = iterator.next(); next && count < MAX_OCCURRENCES_PER_EVENT; next = iterator.next(), count += 1) {
      const details = main.getOccurrenceDetails(next);
      if (details.startDate.toJSDate().getTime() >= toMs && !details.startDate.isDate) break;
      if (details.startDate.isDate && Date.parse(`${dateOnly(details.startDate)}T00:00:00${TAIPEI_OFFSET}`) >= toMs) break;
      add(details.item, details.startDate, details.endDate, `${uid}:${toIso(details.recurrenceId)}`);
    }
  }

  return events.sort((a, b) => startMs(a) - startMs(b) || a.title.localeCompare(b.title));
}

/** Public iCal feed for a Google Calendar ID. */
export function googleCalendarFeedUrl(calendarId: string) {
  return `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendarId)}/public/basic.ics`;
}

/** Opens the calendar in Google Calendar, where visitors can add it to their own. */
export function googleCalendarAddUrl(calendarId: string) {
  return `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(calendarId)}`;
}

/** Subscribe link for Apple Calendar / Outlook. */
export function googleCalendarSubscribeUrl(calendarId: string) {
  return googleCalendarFeedUrl(calendarId).replace(/^https:/, "webcal:");
}
