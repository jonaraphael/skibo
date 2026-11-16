import { after, before, test } from "node:test";
import "firebase/compat/database";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  get,
  onValue,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from "firebase/database";

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-skibo",
    database: {
      host: "127.0.0.1",
      port: 9470,
      rules: await readFile("database.rules.json", "utf8"),
    },
  });
});
after(async () => {
  await env?.cleanup();
});

test("only the owner can read/write a notebook; collection access and deletion are denied", async () => {
  const owner = env.authenticatedContext("owner").database();
  const other = env.authenticatedContext("other").database();
  const guest = env.unauthenticatedContext().database();
  const value = { revision: 0, json: "{}" };
  await assertSucceeds(set(ref(owner, "notebooks/owner"), value));
  await assertSucceeds(get(ref(owner, "notebooks/owner")));
  for (const db of [other, guest]) {
    await assertFails(get(ref(db, "notebooks/owner")));
    await assertFails(
      set(ref(db, "notebooks/owner"), { ...value, revision: 1 }),
    );
  }
  await assertFails(get(ref(owner, "notebooks")));
  await assertFails(remove(ref(owner, "notebooks/owner")));
  await assertFails(
    update(ref(owner, "notebooks/owner"), {
      json: "changed without a revision",
    }),
  );
  await assertFails(
    set(ref(owner, "notebooks/owner"), { ...value, revision: 2 }),
  );
  await assertFails(
    set(ref(owner, "notebooks/owner"), { ...value, revision: 1, extra: true }),
  );
});

test("concurrent saves from the same revision commit exactly once", async () => {
  const first = ref(
    env.authenticatedContext("race").database(),
    "notebooks/race",
  );
  const second = ref(
    env.authenticatedContext("race").database(),
    "notebooks/race",
  );
  await set(first, { revision: 0, json: "before" });
  const stops = [];
  await Promise.all(
    [first, second].map(
      (path) =>
        new Promise((resolve) => {
          stops.push(onValue(path, resolve));
        }),
    ),
  );
  const save = (path, json) =>
    runTransaction(
      path,
      (value) => (value?.revision === 0 ? { revision: 1, json } : undefined),
      { applyLocally: false },
    );
  const outcomes = await Promise.all([
    save(first, "phone"),
    save(second, "computer"),
  ]);
  assert.equal(outcomes.filter((result) => result.committed).length, 1);
  assert.equal((await get(first)).val().revision, 1);
  stops.forEach((stop) => stop());
});
