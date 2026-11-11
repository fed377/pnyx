import { useCallback, useEffect, useState } from "react";

type Settled<T> = { key: string; attempt: number; data: T | null; error: unknown };

/**
 * One remote read. Runs `fetch` whenever `key` changes or `refresh()` is
 * called, and keeps the last answer for that key. `loading` and `error` are
 * worked out from whether the current key and attempt have settled, so the
 * effect never sets state before the request returns. A null `key` fetches
 * nothing (offline mode). `fetch` resolving to null (no session) keeps
 * whatever was there.
 */
export function useRemote<T>(key: string | null, fetch: () => Promise<T | null>) {
  const [attempt, setAttempt] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    let alive = true;
    const keep = (prev: Settled<T> | null) => (prev?.key === key ? prev.data : null);
    fetch().then(
      (data) => alive && setSettled((prev) => ({ key, attempt, data: data ?? keep(prev), error: null })),
      (error: unknown) => alive && setSettled((prev) => ({ key, attempt, data: keep(prev), error })),
    );
    return () => {
      alive = false;
    };
  }, [key, attempt, fetch]);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);
  /** Edits the loaded data in place, e.g. to add something just posted. */
  const mutate = useCallback(
    (fn: (data: T | null) => T | null) => setSettled((prev) => prev && { ...prev, data: fn(prev.data) }),
    [],
  );

  const current = key !== null && settled?.key === key ? settled : null;
  const done = current !== null && current.attempt === attempt;
  return {
    data: current?.data ?? null,
    loading: key !== null && !done,
    /** The current attempt's failure; cleared as soon as a retry starts. */
    error: done ? current.error : null,
    refresh,
    mutate,
  };
}
