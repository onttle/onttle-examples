# _gateway — the example.onttle.com router

The Vercel project that owns the `example.onttle.com` domain. It has no app code: the rewrites in [`vercel.json`](vercel.json) proxy each path to an example app (each its own Vercel project). `/` is the index page, [`public/index.html`](public/index.html).

| Path | Example | Target Vercel project |
| --- | --- | --- |
| `/blog/*` | [blog](../blog) | `onttle-examples-blog` → `https://onttle-examples-blog.vercel.app/blog/*` |
| `/help-center/*` | [help-center](../help-center) | `onttle-examples-help-center` → `https://onttle-examples-help-center.vercel.app/help-center/*` |
| `/i18n-landing/*` | [i18n-landing](../i18n-landing) | `onttle-examples-i18n-landing` → `https://onttle-examples-i18n-landing.vercel.app/i18n-landing/*` |
| `/feedback-board/*` | [feedback-board](../feedback-board) | `onttle-examples-feedback-board` → `https://onttle-examples-feedback-board.vercel.app/feedback-board/*` |
| `/event-rsvp/*` | [event-rsvp](../event-rsvp) | `onttle-examples-event-rsvp` → `https://onttle-examples-event-rsvp.vercel.app/event-rsvp/*` |

## Adding a new example

1. Set `basePath: "/<name>"` in the example app's `next.config.ts`. Use `next/link` for links and `next/form` for forms so the basePath is added. `NEXT_PUBLIC_SITE_URL` is `https://example.onttle.com/<name>`.
2. Create the Vercel project `onttle-examples-<name>` and set its Root Directory to `<name>`.
3. Add two rewrite lines to `vercel.json` in this folder.
   ```json
   { "source": "/<name>", "destination": "https://onttle-examples-<name>.vercel.app/<name>" },
   { "source": "/<name>/:path*", "destination": "https://onttle-examples-<name>.vercel.app/<name>/:path*" }
   ```
4. Add one line to the list in `public/index.html` and to the table in the root README.

## Vercel settings

- Project: `onttle-examples-gateway`, Root Directory `_gateway`, Framework Preset `Other`, no build command
- Domain: `example.onttle.com` (DNS: `CNAME example → cname.vercel-dns.com`)
