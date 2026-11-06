# Supabase

Apply `migrations/20261106120000_gallery.sql` in the Supabase SQL editor, or with the CLI after `supabase link`:

```bash
supabase db push
```

Then, in Authentication, enable the GitHub provider and set the callback URL to `https://<project-ref>.supabase.co/auth/v1/callback`. Add the deployed site origin, including `http://localhost:5173` for local development, to the redirect allow list. The app sends users back to `/?next=vault` and only follows that exact value.

The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Both are public in the built site. Row Level Security is what keeps writes limited to the signed-in owner. Do not create a client with any other key, and do not put a privileged key in the repository, CI, or this file.

Authenticated users can insert and edit their own visible templates and cannot change `status` or `owner`. Hiding a template is done by the project owner in the SQL editor, for example after reading `public.reports`. Each user can publish at most 10 templates per day. A trigger rejects rows whose YAML matches common token and private-key shapes. The browser also blocks secrets, critical findings, and grades below B before the request is sent.
