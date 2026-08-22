import { signal, WritableSignal } from '@angular/core';

export class ListCacheManager<T> {
  readonly cachedItems: WritableSignal<T[]>;
  private isReady = false;
  private readonly enabled: boolean;

  constructor(enabled = false, initialItems: T[] = []) {
    this.enabled = enabled;
    this.cachedItems = signal<T[]>(initialItems);
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  get isCacheReady(): boolean {
    return this.enabled && this.isReady;
  }

  invalidate(): void {
    this.isReady = false;
    this.cachedItems.set([]);
  }

  setCache(items: T[]): void {
    if (!this.enabled) return;
    this.cachedItems.set(items);
    this.isReady = true;
  }

  getCache(): T[] {
    return this.cachedItems();
  }

  /**
   * Helper to find an item by id or control
   */
  findMatch(id: string, matcher?: (item: T, id: string) => boolean): T | undefined {
    if (!this.isCacheReady) return undefined;
    return this.cachedItems().find(row => matcher ? matcher(row, id) : this.defaultMatcher(row, id));
  }

  private defaultMatcher(row: T, id: string): boolean {
    const record = row as { id?: string; control?: string };
    return record.id === id || record.control === id;
  }

  onMutated(
    action: 'create' | 'update' | 'remove' | 'bulk',
    payload?: T | string,
    matcher?: (item: T, id: string) => boolean
  ): boolean {
    if (!this.enabled || !this.isReady) return false;

    if (action === 'bulk') {
      return true; // Signals that a full refresh is needed
    }

    if (action === 'remove' && typeof payload === 'string') {
      this.cachedItems.update(list => list.filter(row => !(matcher ? matcher(row, payload) : this.defaultMatcher(row, payload))));
      return false;
    }

    if (payload && typeof payload === 'object') {
      const row = payload as T & { id?: string };
      if (action === 'create') {
        this.cachedItems.update(list => [...list, row]);
        return false;
      }
      if (action === 'update' && row.id) {
        this.cachedItems.update(list =>
          list.map(item => ((item as { id?: string }).id === row.id ? row : item))
        );
        return false;
      }
    }

    return true; // Fallback to full refresh
  }
}
