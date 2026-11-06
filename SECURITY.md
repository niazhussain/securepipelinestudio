# Security policy

SecurePipeline Studio analyses workflow files in the browser. It does not run them. The notes below are the threat model for the app itself.

## Reporting

Report a vulnerability privately to the maintainers of this repository. Please do not open a public issue for a problem that is still exploitable. Include the version, the route, and a minimal case that does not contain a real secret. You will get an acknowledgement, and a fix will be released when one is confirmed.

## What the app is allowed to do

- Parse and score a workflow on the machine that opened the page.
- Keep a draft, settings, and a short grade history in `localStorage` under `sps:v1:*`.
- Build a share link in the URL fragment. The fragment is not sent to the host by the browser.
- When both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are present, sign in with GitHub through Supabase Auth and read or insert gallery rows. Those two values are public in the built site. Row Level Security is the control.

## What it must not do

- Send the workflow anywhere except a share link you copy, an export you download, or a template you choose to publish.
- Store tokens or the workflow text in history. A draft that matches the secret scanner is not written.
- Render visitor-supplied YAML or text as HTML. There is no `dangerouslySetInnerHTML`, `eval`, or `new Function`.
- Load a third-party script, font, analytics endpoint, or CDN.
- Call GitHub's API. A commit SHA is checked as 40 hexadecimal characters only.
- Use any database key other than the anon key. The SQL migrations do not grant the browser a way to change template status.

## Trust boundaries

| Boundary | Untrusted input | Control |
| --- | --- | --- |
| Editor and imported file | Workflow text, up to 256 KB | Parsed locally. Errors stay generic. |
| Share link | Compressed JSON in the fragment | Zod schema, 256 KB decompressed cap, generic rejection. |
| Gallery rows | Title, description, tags, YAML, handle | Zod on read. Grade recomputed locally. Rendered as text. |
| Publish | The same fields plus a confirmation | Client gate, then SQL length checks, a secret-pattern trigger, and a daily cap. |
| Auth return | `next` query | Only the exact value `vault` is followed. |

A modified client can still insert YAML that is not a secret and is not blocked by the length checks. The gallery labels every community template unverified. Hiding a row is a status change, which the authenticated role cannot make.

## Content Security Policy

The production page sets a CSP in a meta tag because GitHub Pages cannot set response headers. `script-src` is `'self'`. `style-src` allows `'unsafe-inline'` because CodeMirror writes inline styles. `connect-src` is `'self'` plus the Supabase origin when that origin was present at build time. A meta policy cannot set `frame-ancestors`, and a worker is governed by `script-src`. The local development server relaxes the policy so Vite's module loader can run. That relaxed policy is not the one in `dist/index.html`.

## Out of scope

The app does not verify that a SHA belongs to a release, does not execute user workflows, and does not add telemetry.
