import { Injectable, signal, computed } from '@angular/core';

export interface LoadingProgress {
  current: number;
  total: number;
}

/**
 * Global loading overlay state (reference-counted for nested Supabase calls).
 */
@Injectable({
  providedIn: 'root',
})
export class LoadingService {
  private activeRequests = 0;
  private visibleRequests = 0;

  readonly isLoading = signal(false);
  readonly message = signal<string | null>(null);
  readonly progress = signal<LoadingProgress | null>(null);

  readonly progressLabel = computed(() => {
    const p = this.progress();
    if (!p || p.total <= 0) return null;
    return `${p.current} / ${p.total}`;
  });

  /** Start or nest a loading operation. Pass {@link silent} for background bootstrap reads. */
  begin(message?: string, options?: { silent?: boolean }): void {
    this.activeRequests++;
    if (!options?.silent) {
      this.visibleRequests++;
      this.isLoading.set(true);
      if (message) {
        this.message.set(message);
      }
    }
  }

  /** @deprecated Prefer {@link begin}. */
  show(message?: string): void {
    this.begin(message);
  }

  updateMessage(message: string): void {
    this.message.set(message);
  }

  setProgress(current: number, total: number): void {
    this.progress.set({ current, total });
  }

  clearProgress(): void {
    this.progress.set(null);
  }

  /** End one nested loading operation. */
  end(options?: { silent?: boolean }): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
    if (!options?.silent) {
      this.visibleRequests = Math.max(0, this.visibleRequests - 1);
    }

    if (this.visibleRequests <= 0) {
      this.isLoading.set(false);
      this.message.set(null);
      this.progress.set(null);
    }
  }

  /** @deprecated Prefer {@link end}. */
  hide(): void {
    this.end();
  }
}
