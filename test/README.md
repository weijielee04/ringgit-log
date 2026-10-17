# Tests

Run `bash build.sh` first. The browser tests use [Playwright](https://playwright.dev/) with Chromium and take pdf.js 6.2.108 and JSZip 3.10.1 from `/opt/npm-tools/node_modules`; change those paths in the scripts if yours differ.

| Command | What it checks |
|---|---|
| `node test/unit.cjs` | Dates, amounts, toll rates, prompts and record checks |
| `node test/unit2.cjs` | Reading and writing Excel and CSV files |
| `node test/fn/run.mjs` | The `read` and `delete-account` Edge Functions, run against stand-ins for Supabase and the Anthropic API (needs esbuild) |
| `SHOTS=<folder> node test/web/run-web.cjs` | The website in a browser, with the real supabase-js client against `test/web/fake-backend.cjs`, a stand-in for Supabase Auth, the database, Storage and the functions. Screenshots go to the folder |
| `SHOTS=<folder> SEED=<examples.json> node test/run.cjs` (and `run2.cjs`, `run3.cjs`) | The Claude artifact version, with the Claude host mocked |

`test/web/supabase-umd.js` is supabase-js 2.117.2 built from its source with `test/web/build-supabase-umd.mjs`, the same bundle the website loads from jsDelivr. `test/react-global.js` is React for the browser tests.

The database's security rules were tested separately on the Supabase project itself, with SQL run as two different accounts and rolled back afterwards.
