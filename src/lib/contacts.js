import { daysBetween } from "@/lib/dates";
import { CONTACT_STATUSES } from "@/types/contact";

const [NOT_REACHED_OUT, REACHED_OUT, MEETING_SET] = CONTACT_STATUSES;

/**
 * Days since a meeting that has already come and gone while the contact is
 * still parked in "Responded/Meeting Set", or null if nothing is overdue.
 *
 * This is the one thing the status pill genuinely cannot tell you. "Reached
 * Out" looks identical whether it happened yesterday or three weeks ago, and
 * nothing in the stored contact records when that status was set — so a
 * meeting date that has passed is the only staleness the current data can
 * honestly support. Recording when a status last changed would cover the rest.
 */
export function pastDueMeetingDays(contact, todayISO) {
  if (contact.status !== MEETING_SET || !contact.meetingDate) return null;
  const days = daysBetween(contact.meetingDate, todayISO);
  return days > 0 ? days : null;
}

/**
 * Counts for the "where does outreach stand" line above the contact cards.
 * Scanning twenty cards to work out that six orgs were never contacted is
 * exactly the digging PRODUCT.md says this page should save an officer.
 */
export function summarizeContacts(contacts, todayISO) {
  let notReachedOut = 0;
  let awaitingReply = 0;
  let meetingPassed = 0;

  for (const contact of contacts) {
    // An unset status is the starting state, same as an explicit one.
    if (!contact.status || contact.status === NOT_REACHED_OUT) notReachedOut++;
    else if (contact.status === REACHED_OUT) awaitingReply++;
    if (pastDueMeetingDays(contact, todayISO) !== null) meetingPassed++;
  }

  return { notReachedOut, awaitingReply, meetingPassed };
}
