// A stand-in for @supabase/supabase-js inside the Edge Functions: just what they call.
export const state = { usage: {}, files: {}, removed: [], deletedUsers: [], keys: [] };
const USERS = { "user-a": { id: "user-a", email: "a@example.invalid" }, "user-b": { id: "user-b", email: "b@example.invalid" }, "user-c": { id: "user-c", email: "c@example.invalid" } };
export function createClient(url, key) {
  state.keys.push(key);
  return {
    auth: {
      getUser: async (token) => USERS[token] ? { data: { user: USERS[token] }, error: null } : { data: { user: null }, error: { message: "invalid JWT" } },
      admin: { deleteUser: async (id) => { state.deletedUsers.push(id); return { data: {}, error: null }; } }
    },
    rpc: async (name, args) => {
      const u = state.usage;
      if (name === "ai_used_today") return { data: u[args.p_user] || 0, error: null };
      if (name === "ai_refund") { u[args.p_user] = Math.max(0, (u[args.p_user] || 0) - 1); return { data: null, error: null }; }
      if (name === "ai_take") {
        const site = Object.values(u).reduce((s, n) => s + n, 0);
        if (site >= args.p_site_limit) return { data: -2, error: null };
        if ((u[args.p_user] || 0) >= args.p_user_limit) return { data: -1, error: null };
        u[args.p_user] = (u[args.p_user] || 0) + 1;
        return { data: u[args.p_user], error: null };
      }
      return { data: null, error: { message: "no such function" } };
    },
    storage: {
      from: (bucket) => ({
        list: async (prefix) => ({ data: (state.files[prefix] || []).map((n) => ({ id: "id-" + n, name: n, metadata: { size: 10 } })), error: null }),
        remove: async (paths) => {
          paths.forEach((p) => { state.removed.push(p); const [dir, name] = p.split("/"); state.files[dir] = (state.files[dir] || []).filter((x) => x !== name); });
          return { data: paths.map((p) => ({ name: p })), error: null };
        }
      })
    }
  };
}
