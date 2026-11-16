import { Notebook } from "../../app/types";
import { emptyNotebook, parseNotebook } from "./notebook";

const DB_NAME = "skibo";
let connection: Promise<IDBDatabase> | undefined;
const database = (): Promise<IDBDatabase> =>
  (connection ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("notebook");
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        connection = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      connection = undefined;
      reject(request.error);
    };
    request.onblocked = () => {
      connection = undefined;
      reject(
        new Error("Close other Skibo tabs, then reload to open your notebook."),
      );
    };
  }));
export const loadNotebook = async (): Promise<Notebook> => {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notebook", "readwrite");
    const store = tx.objectStore("notebook");
    const request = store.get("root");
    let result: Notebook;
    request.onsuccess = () => {
      try {
        if (request.result) {
          result = parseNotebook(request.result);
          if (request.result.version !== result.version) {
            // Commit the upgrade atomically and invalidate older open tabs.
            result = { ...result, revision: result.revision + 1 };
            parseNotebook(result);
            store.put(result, "root");
          }
        } else {
          result = emptyNotebook();
          store.put(result, "root");
        }
      } catch (error) {
        tx.abort();
        reject(error);
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("The notebook could not be opened."));
  });
};
export const saveNotebook = async (data: Notebook): Promise<void> => {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notebook", "readwrite");
    const store = tx.objectStore("notebook");
    const request = store.get("root");
    request.onsuccess = () => {
      if (!request.result || request.result.revision !== data.revision - 1) {
        reject(
          new Error(
            "Another tab changed your notebook. Download your current copy, then reload to use the saved version.",
          ),
        );
        tx.abort();
        return;
      }
      store.put(data, "root");
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error ??
          new Error(
            "Your changes could not be saved. Download a backup before reloading.",
          ),
      );
  });
};

export const readStoredData = async (): Promise<string> => {
  const db = await database();
  const root = await new Promise<unknown>((resolve, reject) => {
    const request = db
      .transaction("notebook", "readonly")
      .objectStore("notebook")
      .get("root");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  if (root !== undefined) return JSON.stringify(root, null, 2);
  throw new Error("No stored notebook could be read in this browser.");
};

export interface CloudCache {
  revision: number;
  data: Notebook;
}
export const loadCloudCache = async (
  uid: string,
): Promise<CloudCache | null> => {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db
      .transaction("notebook", "readonly")
      .objectStore("notebook")
      .get(`account:${uid}`);
    request.onsuccess = () => {
      try {
        const cached = request.result as CloudCache | undefined;
        resolve(
          cached
            ? { revision: cached.revision, data: parseNotebook(cached.data) }
            : null,
        );
      } catch (error) {
        reject(error);
      }
    };
    request.onerror = () => reject(request.error);
  });
};
export const saveCloudCache = async (
  uid: string,
  cached: CloudCache,
): Promise<void> => {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notebook", "readwrite");
    const store = tx.objectStore("notebook");
    const request = store.get(`account:${uid}`);
    request.onsuccess = () => {
      if (!request.result || request.result.revision <= cached.revision)
        store.put(cached, `account:${uid}`);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(tx.error ?? new Error("The offline copy could not be saved."));
  });
};

// Used only after an explicit confirmation on the local recovery screen.
export const resetLocalNotebook = async (): Promise<void> => {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("notebook", "readwrite");
    const store = tx.objectStore("notebook");
    const request = store.get("root");
    request.onsuccess = () => {
      const previous = request.result?.revision;
      const revision =
        Number.isSafeInteger(previous) &&
        previous >= 0 &&
        previous < Number.MAX_SAFE_INTEGER
          ? previous + 1
          : 0;
      store.put({ ...emptyNotebook(), revision }, "root");
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () =>
      reject(
        tx.error ??
          new Error(
            "Could not start a new notebook. Your stored data has been kept.",
          ),
      );
  });
};
