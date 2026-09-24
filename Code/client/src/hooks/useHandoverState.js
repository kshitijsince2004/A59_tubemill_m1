import { useCallback, useEffect, useRef, useState } from 'react';
import { machineHandoverService } from '../lib/machineHandoverService';
import { isConcreteMachineCode } from '../lib/machineCodes';

const DEDUPE_MS = 8_000;
/** @type {Map<string, { at: number, data: unknown }>} */
const cache = new Map();

function useHandoverFetch(key, fetcher, enabled = true) {
  const [data, setData] = useState(() => {
    if (!key || !enabled) return undefined;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < DEDUPE_MS) return hit.data;
    return undefined;
  });
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(Boolean(key && enabled));
  const hardFailRef = useRef(false);

  const mutate = useCallback(
    async (next, opts = {}) => {
      if (next !== undefined) {
        setData(next);
        if (key) cache.set(key, { at: Date.now(), data: next });
      }
      if (opts.revalidate === false) return next;
      if (!key || !enabled) return;
      if (hardFailRef.current && !opts.force) return;
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetcher();
        hardFailRef.current = false;
        setData(result);
        cache.set(key, { at: Date.now(), data: result });
        return result;
      } catch (e) {
        const status = e?.status;
        if (status === 401 || status === 403) hardFailRef.current = true;
        setError(e);
        // Swallow — callers read `error`; never leave unhandled rejections
        return undefined;
      } finally {
        setIsLoading(false);
      }
    },
    [key, enabled, fetcher]
  );

  useEffect(() => {
    hardFailRef.current = false;
    if (!key || !enabled) {
      setIsLoading(false);
      return;
    }
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < DEDUPE_MS) {
      setData(hit.data);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    void fetcher()
      .then((result) => {
        if (cancelled) return;
        hardFailRef.current = false;
        setData(result);
        cache.set(key, { at: Date.now(), data: result });
      })
      .catch((e) => {
        if (cancelled) return;
        const status = e?.status;
        if (status === 401 || status === 403) hardFailRef.current = true;
        setError(e);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [key, enabled, fetcher]);

  return { data, error, isLoading, mutate };
}

function handoverEnabled(machineCode, enabled) {
  return Boolean(machineCode && enabled && isConcreteMachineCode(machineCode));
}

export function useHandoverPending(machineCode, enabled = true) {
  const on = handoverEnabled(machineCode, enabled);
  const key = on ? `handover:pending:${machineCode}` : null;
  const fetcher = useCallback(async () => {
    const res = await machineHandoverService.getPending(machineCode);
    return res?.pending ?? null;
  }, [machineCode]);
  return useHandoverFetch(key, fetcher, on);
}

export function useHandoverPreview(machineCode, enabled = true) {
  const on = handoverEnabled(machineCode, enabled);
  const key = on ? `handover:preview:${machineCode}` : null;
  const fetcher = useCallback(
    () => machineHandoverService.getPreview(machineCode),
    [machineCode]
  );
  return useHandoverFetch(key, fetcher, on);
}

export function useHandoverDraft(machineCode, enabled = true) {
  const on = handoverEnabled(machineCode, enabled);
  const key = on ? `handover:draft:${machineCode}` : null;
  const fetcher = useCallback(async () => {
    const res = await machineHandoverService.getDraft(machineCode);
    return res?.draft ?? null;
  }, [machineCode]);
  return useHandoverFetch(key, fetcher, on);
}
