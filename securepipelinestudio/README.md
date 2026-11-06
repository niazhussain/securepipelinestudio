# SecurePipeline Studio

SecurePipeline Studio is a static web app that reviews GitHub Actions workflows in the browser. It explains findings, keeps a gallery of templates, and walks through a few attack paths. Analysis does not leave the browser unless you publish a template or copy a share link.

## Setup

```bash
npm ci
npm run dev
```

Other scripts: `build`, `preview`, `lint`, `typecheck`, `test`, and `audit`.

Copy `.env.example` to `.env` for local overrides. Leave the Supabase lines empty to run with the bundled starter templates and no gallery network calls.

`VITE_BASE_PATH` defaults to `/securepipelinestudio/` when it is unset, which matches a project site at `https://<user>.github.io/securepipelinestudio/`. Set `VITE_BASE_PATH=/` for `npm run dev` and `npm run preview`. Any `VITE_*` value is compiled into the public site.

## Environment

| Variable | Purpose |
| --- | --- |
| `VITE_BASE_PATH` | Vite `base`. Use `/` locally and `/<repository>/` on project Pages. |
| `VITE_SUPABASE_URL` | Optional `https` project URL. The client is not created unless this and the anon key are both set. |
| `VITE_SUPABASE_ANON_KEY` | Optional anon key. It is public by design. |

Do not add a privileged database key to `.env`, CI, or the built site. The deploy workflow reads the URL and anon key from repository variables, not from secrets, because they are visible in the bundle.

## Supabase and GitHub sign-in

Apply `supabase/migrations/20261106120000_gallery.sql` in the SQL editor, or with `supabase db push` after linking the project. The migration creates `templates` and `reports`, enables row level security, checks lengths, rejects common token shapes, and caps publishes at 10 a day. Details are in `supabase/README.md`.

In the Supabase dashboard, enable the GitHub provider. Set the provider callback to `https://<project-ref>.supabase.co/auth/v1/callback`. Allow the site origin, including `http://localhost:5173` for local work. The app returns to `/?next=vault` and ignores every other `next` value.

Without the two variables, the Vault shows the starter templates, publishing is disabled, and the page does not call Supabase.

## Deploy

GitHub Pages for a private repository may require a paid plan. Public repositories can use the free project site.

The workflow in `.github/workflows/deploy.yml` runs on pushes to `main` and on manual dispatch. It installs with `npm ci`, then lints, typechecks, tests, and builds. Pages permissions are granted on that job only. Actions are pinned to full commit SHAs. Set the repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` if the deployed gallery should be writable. Leave them empty to ship the starter gallery.

`.github/workflows/ci.yml` repeats the checks on pull requests. Dependabot watches npm and GitHub Actions.

## Security model

Results are static analysis. A grade is not a guarantee, and a SHA is not checked against a release. The production CSP is a meta tag: `default-src 'self'`, scripts from `'self'`, inline styles because the editor needs them, images from `'self'` and `data:`, and connections to `'self'` plus the configured Supabase origin. A meta policy cannot express every header, including `frame-ancestors`. The development server adds the exceptions Vite needs to load modules. Those exceptions are not in the production HTML.

There is no telemetry and no cookie set by this app. Share links live in the hash (`#/s?d=...`), which the browser does not send to the server. Exports and publishing run the secret scanner first and stop when it matches. Community templates are labeled unverified, and the grade is computed again on load.

`SECURITY.md` is the threat model and the reporting path.

The interface uses the operating system's UI and monospace fonts. No font file is downloaded.

## Routes

`/` editor and scorecard, `/vault` gallery, `/threat-modeler` and `/threat-modeler/:scenarioId` lessons, `/s` shared report, `/about` privacy, and a not-found page. Routing uses the hash so project Pages can refresh any screen.

## Dependencies

Runtime packages are the ones named for this app: React 19, React Router 7, the `yaml` parser, CodeMirror 6 (`codemirror` plus the view, state, commands, YAML, and lint packages), Zod, Supabase, `lz-string`, and Lucide. Tailwind is build-time only. Nothing else is loaded from a CDN.

`npm run audit` fails the production tree at moderate or above. The full tree, including development tools, fails at high or above. `typescript-eslint` currently depends on a `minimatch` release with an unfixed moderate advisory, and forcing the audit fix would downgrade the linter.

## Assumptions

- First-party actions are `actions/` and `github/` only. Other owners must use a 40-character SHA.
- `permissions: {}` counts as set. One ordinary write scope, such as `contents: write` or `pages: write`, is not treated as broad. `write-all`, two or more write scopes, or `actions` / `administration` / `members: write`, is broad.
- `id-token: write` is accepted when the job uses a known OpenID Connect action, including `actions/deploy-pages`.
- A score of 90 or more that still has a high finding is grade B. One critical finding caps the grade at D. Two or more force F. Info never changes the grade.
- Script injection is flagged for `${{ }}` inside `run` or `actions/github-script`. Values copied into environment variables are the safe pattern. The engine does not follow those variables into a later command.
- `pull_request`, issue, comment, discussion, `workflow_run`, and similar events are untrusted for self-hosted runners. `push`, `schedule`, and `workflow_dispatch` are not. A matrix expression is not called self-hosted unless the text contains `self-hosted`.
- Multiple YAML documents: the first is analysed and a warning is shown. Duplicate keys follow the `yaml` library and become a parse error.
- The form keeps unknown keys. Comments can be dropped when the form writes the file back.
- New jobs created in the form start with `contents: read`, a 15 minute timeout, and `ubuntu-latest`. The form does not insert a third-party hardening action on your behalf.
- Share links that omit the workflow show the sender's grade as an unverified snapshot. Links that include it are scored again.
- History stores the grade, score, finding count, and name. It does not store the workflow. Drafts that match the secret scanner stay in memory only.
- The saved theme can flash dark on load. An inline boot script would violate `script-src 'self'`.
- The gallery shows the newest 60 visible rows and filters search, tag, and grade in the browser. The stored row has no grade.
- The displayed author handle is the GitHub username from the sign-in metadata. It is self-reported from that metadata. The app does not call the GitHub API.
- A modified client can insert YAML that passes the SQL checks and is still a poor workflow. The browser gate is not the only control, and it is not sufficient on its own. Status changes are made in the SQL editor by the project owner.
- The daily publish cap is 10.
- `npm run audit` uses a high threshold for development dependencies because of the unfixed `minimatch` advisory above.
