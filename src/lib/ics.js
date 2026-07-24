import { CHAPTER_NAME } from "@/lib/config";
import {
  addDays,
  parseISODate,
  formatISODate,
  DEFAULT_DURATION_MINUTES,
} from "@/lib/dates";

function escapeText(text) {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// RFC 5545 line folding: no line may exceed 75 octets; continuations start with a space.
function foldLine(line) {
  const bytes = Buffer.byteLength(line, "utf8");
  if (bytes <= 75) return line;

  const folded = [];
  let rest = line;
  let limit = 75;
  while (Buffer.byteLength(rest, "utf8") > limit) {
    let end = limit;
    while (Buffer.byteLength(rest.slice(0, end), "utf8") > limit) end--;
    folded.push(rest.slice(0, end));
    rest = rest.slice(end);
    limit = 74; // continuation lines lose one octet to the leading space
  }
  folded.push(rest);
  return folded.join("\r\n ");
}

function dateStamp(iso) {
  return iso.replace(/-/g, "");
}

function timeStamp(time) {
  const [hours, minutes] = time.split(":");
  return `${hours.padStart(2, "0")}${minutes.padStart(2, "0")}00`;
}

function utcDateTimeStamp(date) {
  return (
    date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z"
  );
}

export function buildICS(
  events,
  semesterLabel,
  categoriesById,
) {
  const hostEvents = events.filter((e) => !categoriesById.get(e.category)?.isOtherOrgCategory);
  const now = utcDateTimeStamp(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${CHAPTER_NAME} Social Calendar//EN`,
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${escapeText(`${CHAPTER_NAME} Events - ${semesterLabel}`)}`,
  ];

  for (const event of hostEvents) {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.id}@social-calendar`);
    lines.push(`DTSTAMP:${now}`);

    if (event.startTime) {
      const startStamp = `${dateStamp(event.startDate)}T${timeStamp(event.startTime)}`;
      let endStamp;
      if (event.endTime) {
        endStamp = `${dateStamp(event.endDate)}T${timeStamp(event.endTime)}`;
      } else {
        const end = addMinutesToDateTime(event.startDate, event.startTime, DEFAULT_DURATION_MINUTES);
        endStamp = `${dateStamp(end.date)}T${end.time}`;
      }
      lines.push(`DTSTART:${startStamp}`);
      lines.push(`DTEND:${endStamp}`);
    } else {
      const exclusiveEnd = formatISODate(addDays(parseISODate(event.endDate), 1));
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(event.startDate)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(exclusiveEnd)}`);
    }

    lines.push(`SUMMARY:${escapeText(event.name)}`);
    lines.push(`CATEGORIES:${escapeText(categoriesById.get(event.category)?.label ?? "Uncategorized")}`);
    lines.push(`STATUS:${event.status === "confirmed" ? "CONFIRMED" : "TENTATIVE"}`);

    const descriptionParts = [`Host: ${event.host}`];
    if (event.notes.trim()) descriptionParts.push(event.notes.trim());
    lines.push(`DESCRIPTION:${descriptionParts.map(escapeText).join("\\n\\n")}`);

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

function addMinutesToDateTime(
  dateIso,
  time,
  minutes,
) {
  const [hours, mins] = time.split(":").map(Number);
  const totalMinutes = hours * 60 + mins + minutes;
  const dayOffset = Math.floor(totalMinutes / (24 * 60));
  const minuteOfDay = totalMinutes - dayOffset * 24 * 60;
  const h = Math.floor(minuteOfDay / 60).toString().padStart(2, "0");
  const m = (minuteOfDay % 60).toString().padStart(2, "0");
  return {
    date: formatISODate(addDays(parseISODate(dateIso), dayOffset)),
    time: `${h}${m}00`,
  };
}
