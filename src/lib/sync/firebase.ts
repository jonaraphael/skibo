import { initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from "firebase/auth";
import {
  connectDatabaseEmulator,
  getDatabase,
  onValue,
  ref,
  runTransaction,
} from "firebase/database";
import { Notebook } from "../../app/types";
import { parseNotebook } from "../persistence/notebook";

export interface CloudRecord {
  revision: number;
  json: string;
}
export const parseCloudRecord = (value: unknown): CloudRecord => {
  const record = value as CloudRecord | null;
  if (
    !record ||
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    typeof record.json !== "string"
  )
    throw new Error(
      "Your synced notebook could not be read. Your saved data has been kept.",
    );
  parseNotebook(JSON.parse(record.json));
  return record;
};

// A JSON string preserves empty arrays and nulls, which RTDB otherwise removes.
export const cloudRecord = (data: Notebook, revision: number): CloudRecord => ({
  revision,
  json: JSON.stringify(parseNotebook(data)),
});

const configText = import.meta.env.VITE_FIREBASE_CONFIG as string | undefined;
export const syncAvailable = !!configText;
let services: ReturnType<typeof createServices> | undefined;
const createServices = () => {
  const app = initializeApp(JSON.parse(configText!));
  const auth = getAuth(app);
  const db = getDatabase(app);
  if (import.meta.env.VITE_FIREBASE_EMULATORS === "true") {
    connectAuthEmulator(auth, "http://127.0.0.1:9471", {
      disableWarnings: true,
    });
    connectDatabaseEmulator(db, "127.0.0.1", 9470);
  }
  return { auth, db };
};
const firebase = () => (services ??= createServices());
export const watchAuth = (
  next: (user: User | null) => void,
  error: (error: Error) => void,
) => onAuthStateChanged(firebase().auth, next, error);
export const signIn = () =>
  signInWithPopup(firebase().auth, new GoogleAuthProvider());
export const leaveAccount = () => signOut(firebase().auth);

export const watchCloud = (
  uid: string,
  seed: Notebook,
  accept: (record: CloudRecord) => void,
  connected: (online: boolean) => void,
  error: (error: Error) => void,
) => {
  const { db } = firebase();
  const notebook = ref(db, `notebooks/${uid}`);
  let stopped = false;
  let online = false;
  let ready = false;
  let missing = false;
  let creating = false;
  const fail = (e: Error) => {
    if (!stopped) {
      connected(false);
      error(e);
    }
  };
  const createIfMissing = () => {
    if (!online || !missing || creating || stopped) return;
    creating = true;
    void runTransaction(
      notebook,
      (current) => (current === null ? cloudRecord(seed, 0) : undefined),
      { applyLocally: false },
    )
      .then((result) => {
        if (stopped) return;
        accept(parseCloudRecord(result.snapshot.val()));
        ready = true;
        connected(online);
      })
      .catch(fail)
      .finally(() => {
        creating = false;
      });
  };
  // Keep the listener attached: RTDB transactions need its retained server cache.
  const stopNotebook = onValue(
    notebook,
    (value) => {
      if (stopped) return;
      missing = !value.exists();
      if (missing) {
        ready = false;
        connected(false);
        createIfMissing();
        return;
      }
      try {
        accept(parseCloudRecord(value.val()));
        ready = true;
        connected(online);
      } catch (e) {
        fail(e as Error);
      }
    },
    fail,
  );
  const stopConnection = onValue(
    ref(db, ".info/connected"),
    (snapshot) => {
      online = !!snapshot.val();
      connected(online && ready);
      createIfMissing();
    },
    fail,
  );
  return () => {
    stopped = true;
    stopConnection();
    stopNotebook();
  };
};

export class CloudConflict extends Error {
  constructor(public record: CloudRecord) {
    super(
      "Your notebook changed on another device. Please try again. Your draft has been kept.",
    );
  }
}
export const saveCloud = async (
  uid: string,
  expected: number,
  data: Notebook,
): Promise<CloudRecord> => {
  const next = cloudRecord(data, expected + 1);
  const result = await runTransaction(
    ref(firebase().db, `notebooks/${uid}`),
    (current: CloudRecord | null) =>
      current?.revision === expected ? next : undefined,
    { applyLocally: false },
  );
  const record = parseCloudRecord(result.snapshot.val());
  if (!result.committed) throw new CloudConflict(record);
  return record;
};
