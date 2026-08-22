import { Injectable, inject, signal, computed } from '@angular/core';
import { LoadingService } from '@core/services/Utils/loading.service';

export type SupabaseOperationKind = 'idle' | 'read' | 'write' | 'rpc';

/**
 * Signal-backed Supabase transport state — consumed by overlays and coordinators.
 */
@Injectable({ providedIn: 'root' })
export class SupabaseTransportStateService {
  private loading = inject(LoadingService);

  private readonly _kind = signal<SupabaseOperationKind>('idle');
  private readonly _target = signal<string | null>(null);
  private readonly silentStack: boolean[] = [];

  readonly kind = this._kind.asReadonly();
  readonly target = this._target.asReadonly();
  readonly isActive = computed(() => this._kind() !== 'idle');
  readonly message = this.loading.message;
  readonly progress = this.loading.progress;
  readonly progressLabel = this.loading.progressLabel;
  readonly isLoading = this.loading.isLoading;

  begin(
    kind: SupabaseOperationKind,
    target: string,
    message: string,
    options?: { silent?: boolean }
  ): void {
    const silent = options?.silent ?? false;
    this.silentStack.push(silent);
    this._kind.set(kind);
    this._target.set(target);
    this.loading.begin(message, { silent });
  }

  updateProgress(current: number, total: number, message?: string): void {
    this.loading.setProgress(current, total);
    if (message) {
      this.loading.updateMessage(message);
    }
  }

  end(): void {
    const silent = this.silentStack.pop() ?? false;
    this.loading.end({ silent });
    if (this.loading.isLoading()) {
      return;
    }
    this._kind.set('idle');
    this._target.set(null);
  }
}
