# Ringgit Log

An expense tracker for Malaysia. Upload a TnG eWallet history, a CIMB statement, a receipt or a Waze or Google Maps screenshot, check what was read, and see every day and month by type: food, travel (toll, fuel, rides, transit), office and on-site parking, shopping and bills. Trips can be planned with distance and toll, a month can be filled in from an Excel template, and receipts can be attached to records later.

Anyone can create an account. Each account's records and receipt files are private to it.

**Live site:** https://weijielee04.github.io/ringgit-log/

## How it fits together

| Part | Where it lives | What it does |
|---|---|---|
| Website | GitHub Pages, `gh-pages` branch | A static page built from `src/` by `build.sh` |
| Accounts | Supabase Auth | Sign-up and sign-in with email and password, password reset |
| Records | Supabase Postgres, tables `records` and `profiles` | One row per expense; each account's settings and display name |
| Receipt files | Supabase Storage, private bucket `receipts` | One folder per account, shown through links that expire after two hours |
| Reading | Edge Function `read` | Checks the sign-in and the daily limits, then asks Claude to read the picture or statement |
| Deleting an account | Edge Function `delete-account` | Removes the account, its records and its files |

The Supabase project is `ringgit-log` (ref `rjhfvorbgpdubnqfbexc`, Singapore region). Its database is described in `supabase/migrations/`.

### Security

- Row-level security is on for every table and for the `receipts` bucket: an account can only read and change its own rows and the files in its own folder. This was tested by having two accounts try to read and write each other's records and files.
- `site.config.json` holds the project URL and the **publishable** key. Both are meant to be public, since every visitor's browser needs them. `build.sh` refuses to build with a secret key.
- The Anthropic API key and Supabase's secret key exist only as Edge Function secrets, never in the website.
- The `read` function writes its own prompts (from `supabase/functions/read/prompts.js`, generated from the app's source), checks every request and counts readings per account and for the whole site, so it can't be used as a free general-purpose proxy to Claude.

## One-time setup in the Supabase dashboard

1. **Where email links go.** In [Authentication > URL Configuration](https://supabase.com/dashboard/project/rjhfvorbgpdubnqfbexc/auth/url-configuration), set **Site URL** to `https://weijielee04.github.io/ringgit-log/` and add `https://weijielee04.github.io/ringgit-log/**` under **Redirect URLs**.
2. **Letting other people sign up.** Supabase's built-in email only delivers to members of your Supabase team, so anyone else's sign-up fails while **Confirm email** is on. Either turn off **Confirm email** in [Authentication > Sign In / Providers > Email](https://supabase.com/dashboard/project/rjhfvorbgpdubnqfbexc/auth/providers), or set up your own email sender in [Authentication > Emails > SMTP Settings](https://supabase.com/dashboard/project/rjhfvorbgpdubnqfbexc/auth/smtp). "Forgot password" emails also need your own sender to reach people outside your team.
3. **Automatic reading.** Add `ANTHROPIC_API_KEY` (from the [Anthropic Console](https://console.anthropic.com/)) in [Edge Functions > Secrets](https://supabase.com/dashboard/project/rjhfvorbgpdubnqfbexc/functions/secrets). Until then the site works normally and details are typed in. Optional secrets:

   | Secret | Default | Meaning |
   |---|---|---|
   | `READS_PER_ACCOUNT_PER_DAY` | `40` | Readings each account can use per day (Malaysia time) |
   | `READS_PER_DAY` | `300` | Readings the whole site can use per day |
   | `ANTHROPIC_MODEL` | `claude-sonnet-5-5` | The Claude model that reads |
   | `ALLOWED_ORIGINS` | `*` | Comma-separated sites allowed to call the functions, for example `https://weijielee04.github.io` |

## Seeing who has signed up

- [Authentication > Users](https://supabase.com/dashboard/project/rjhfvorbgpdubnqfbexc/auth/users) lists every account with its sign-up and last sign-in time.
- In the [SQL Editor](https://supabase.com/dashboard/project/rjhfvorbgpdubnqfbexc/sql/new), `select * from private.accounts order by signed_up desc;` shows each account's email, display name, sign-up date, last sign-in, number of records and latest record date. The `private` schema isn't reachable from the website, only from your dashboard.
- The Table Editor shows the `records` and `profiles` tables, and Storage shows the `receipts` files.

## Making changes

- The app's source is in `src/`. Files `01` to `06` are shared; `00-web.js`, `07-web.js` and `head-web.html` make the website; `00-artifact.js` and `head.html` make the Claude artifact version.
- `bash build.sh` builds `dist/` (the website), `ringgit-log.html` (the artifact version) and `supabase/functions/read/prompts.js`. It needs `python3` and `node`.
- `bash publish.sh` builds and publishes `dist/` to the `gh-pages` branch.
- Database changes go in a new file in `supabase/migrations/`. The functions deploy with the [Supabase CLI](https://supabase.com/docs/guides/cli), for example `supabase functions deploy read --no-verify-jwt --project-ref rjhfvorbgpdubnqfbexc`. They check the sign-in themselves, which is why `--no-verify-jwt` is used.

## Tests

See `test/README.md`. The website is tested in a real browser with the real Supabase client against a stand-in Supabase server: sign-up, sign-in, password reset, two accounts, reading, receipts, Excel import and export, and account deletion.

## Limits to know

- The free Supabase plan includes a 500 MB database, 1 GB of file storage and 50,000 monthly active users, and free projects are paused after a week without activity. A paused project can be restored from the dashboard.
- The website itself is public on GitHub Pages; the records behind it are not.
- Automatic reading is billed by Anthropic per use, capped by the daily limits above.
