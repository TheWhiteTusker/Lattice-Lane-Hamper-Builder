import { test } from "node:test";
import assert from "node:assert/strict";
import { supabaseEnv, SupabaseConfigError } from "./env.ts";

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const ANON_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved = { [URL_KEY]: process.env[URL_KEY], [ANON_KEY]: process.env[ANON_KEY] };
  try {
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

test("returns both values when configured", () => {
  withEnv({ [URL_KEY]: "https://example.supabase.co", [ANON_KEY]: "sb_publishable_x" }, () => {
    assert.deepEqual(supabaseEnv(), {
      url: "https://example.supabase.co",
      key: "sb_publishable_x",
    });
  });
});

test("names the missing variable rather than failing anonymously", () => {
  withEnv({ [URL_KEY]: undefined, [ANON_KEY]: "sb_publishable_x" }, () => {
    assert.throws(() => supabaseEnv(), (e: Error) => {
      assert.ok(e instanceof SupabaseConfigError);
      assert.match(e.message, /NEXT_PUBLIC_SUPABASE_URL/);
      assert.doesNotMatch(e.message, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
      return true;
    });
  });
});

test("names both when both are missing", () => {
  withEnv({ [URL_KEY]: undefined, [ANON_KEY]: undefined }, () => {
    assert.throws(() => supabaseEnv(), (e: Error) => {
      assert.match(e.message, /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
      // the point of the message is telling you a rebuild is needed
      assert.match(e.message, /rebuild/i);
      return true;
    });
  });
});

test("an empty string counts as missing", () => {
  withEnv({ [URL_KEY]: "", [ANON_KEY]: "sb_publishable_x" }, () => {
    assert.throws(() => supabaseEnv(), SupabaseConfigError);
  });
});
