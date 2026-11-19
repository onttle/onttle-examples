// Served under example.onttle.com/event-rsvp (the gateway proxies /event-rsvp/* to this app).
// next/link and next/form add the basePath; the confirmation cookie is scoped to it as well.
export const BASE_PATH = "/event-rsvp";

/** Set by the RSVP action, read by the confirmation page. Holds the name just typed, never the e-mail. */
export const DONE_COOKIE = "rsvp_done";
