/* ================= platform: the website (GitHub Pages + Supabase) =================
   The project address and publishable key come from site.config.json at build time. They are meant to
   be public: what each visitor can reach is decided by Supabase Auth and the row-level security rules
   in supabase/migrations. The platform code itself is in src/07-web.js. */
const PLATFORM = { web: true, ui: {}, url: "__SUPABASE_URL__", key: "__SUPABASE_KEY__" };
