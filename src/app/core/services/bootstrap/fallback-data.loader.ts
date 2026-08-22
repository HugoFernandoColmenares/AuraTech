import { Injectable } from '@angular/core';

export interface FallbackLoadOptions<T> {
  fetchLive: () => Promise<T[]>;
  fallback: T[];
  onLoaded?: (rows: T[]) => void;
}

/** Tries a live fetch first; falls back to static data on failure or empty result. */
@Injectable({ providedIn: 'root' })
export class FallbackDataLoader {
  async load<T>(options: FallbackLoadOptions<T>): Promise<T[]> {
    try {
      const rows = await options.fetchLive();
      if (rows.length > 0) {
        options.onLoaded?.(rows);
        return rows;
      }
    } catch (err: unknown) {
      console.warn('[FallbackDataLoader] Live fetch failed, using fallback.', err);
    }

    options.onLoaded?.(options.fallback);
    return options.fallback;
  }
}
