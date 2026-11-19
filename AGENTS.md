# AGENTS.md — onttle-examples repository rules

AI coding agents and people both follow these rules.

## Structure

- `<name>/` (directly under the repository root): one example = one independent Next.js app (App Router, TypeScript, Tailwind, `src/`). Examples do not share code.
- `<name>/docs/BUILD_LOG.md`: the build record (prompts per step, what the agent got wrong, where it got stuck).
- `<name>/docs/POST.md`: the post written from this example. Front matter `status: draft | published`.
- `<name>/docs/assets/`: screenshots and GIFs.
- `_gateway/`: the exception. It is not an app but the `example.onttle.com` router (`vercel.json` rewrites + the index page). When you add an example, register it here too: two rewrite lines in `_gateway/vercel.json` (`/<name>` and `/<name>/:path*` → `https://onttle-examples-<name>.vercel.app/<name>…`) and one list item in `_gateway/public/index.html`.

## Onttle API

- Paths and fields follow **that example project's OpenAPI spec**. Do not guess fields or parameters that are not in the spec. When the docs and the spec differ, write it down in BUILD_LOG.
- Keep all calls in `src/lib/onttle.ts`, with `import "server-only"`.
- Use the secret key (`sk-proj_…`) on the server only. Never put a key behind the `NEXT_PUBLIC_` prefix.

## Secrets

- Do not commit real API keys or project IDs. `.env.example` holds names only.

## Definition of done

- `pnpm lint`, `pnpm typecheck`, `pnpm build` pass
- README: demo link, Onttle features used, how to run
- BUILD_LOG written, `.env.example` updated
- Vercel deployment: project `onttle-examples-<name>`, Root Directory `<name>`, `basePath: "/<name>"`, public URL `https://example.onttle.com/<name>`
