// Builds the same IIFE bundle the CDN serves (dist/umd/supabase.js, global "supabase") from the v2.117.2 sources, for tests only.
import * as esbuild from "/opt/npm-tools/node_modules/esbuild/lib/main.js";
const core = "/home/claude/supabase/supabase-js/packages/core";
await esbuild.build({
  entryPoints: [core + "/supabase-js/src/index.ts"],
  bundle: true, format: "iife", globalName: "supabase", platform: "browser", target: "es2019",
  outfile: "/home/claude/supabase/build/supabase.js",
  alias: {
    "@supabase/auth-js": core + "/auth-js/src/index.ts",
    "@supabase/functions-js": core + "/functions-js/src/index.ts",
    "@supabase/postgrest-js": core + "/postgrest-js/src/index.ts",
    "@supabase/realtime-js": core + "/realtime-js/src/index.ts",
    "@supabase/storage-js": core + "/storage-js/src/index.ts",
    "@supabase/tracing": "/home/claude/supabase/supabase-js/packages/shared/tracing/src/index.ts",
    "@supabase/phoenix": "/home/claude/supabase/phoenix/assets/js/phoenix/index.js",
    "iceberg-js": "/home/claude/supabase/build/iceberg-stub.js",
    "tslib": "/opt/npm-tools/node_modules/tslib/tslib.es6.mjs"
  },
  logLevel: "warning"
});
console.log("built");
