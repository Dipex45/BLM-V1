import { useEffect, useState } from 'react';
import { apiGet, apiErrorMessage } from '../lib/api';
import type { PublicCatalog } from '../lib/catalog';

type State = { catalog: PublicCatalog | null; error: string | null; loading: boolean };

let cache: { at: number; promise: Promise<PublicCatalog> } | null = null;
const listeners = new Set<(catalog: PublicCatalog) => void>();
const TTL = 60_000;
const FIRST_RETRY = 5_000;
const SLOWEST_RETRY = 60_000;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = FIRST_RETRY;

/** After a failure, quietly try again (5s, 10s, 20s… up to 60s) so prices appear as soon as the server is back. */
function retryLater() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    if (listeners.size) fetchCatalog(true).catch(() => undefined);
  }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, SLOWEST_RETRY);
}

function fetchCatalog(force = false) {
  if (!cache || force || Date.now() - cache.at > TTL) {
    const promise = apiGet<PublicCatalog>('/api/public/catalog').then((response) => response.data);
    cache = { at: Date.now(), promise };
    promise
      .then((catalog) => {
        retryDelay = FIRST_RETRY;
        listeners.forEach((listener) => listener(catalog));
      })
      .catch(() => {
        cache = null;
        retryLater();
      });
  }
  return cache.promise;
}

/** Call after an admin changes settings so every screen re-reads live prices. */
export const invalidateCatalog = () => fetchCatalog(true);

/** Live public catalog from the server: the only source of prices shown to customers. */
export function useCatalog(): State & { reload: () => void } {
  const [state, setState] = useState<State>({ catalog: null, error: null, loading: true });

  useEffect(() => {
    let active = true;
    const listener = (catalog: PublicCatalog) => active && setState({ catalog, error: null, loading: false });
    listeners.add(listener);
    fetchCatalog()
      .then(listener)
      .catch((error) => active && setState({ catalog: null, error: apiErrorMessage(error, 'Live prices could not be loaded.'), loading: false }));
    return () => {
      active = false;
      listeners.delete(listener);
    };
  }, []);

  return {
    ...state,
    reload: () => {
      setState((current) => ({ ...current, loading: true, error: null }));
      fetchCatalog(true).catch((error) => setState({ catalog: null, error: apiErrorMessage(error), loading: false }));
    },
  };
}
