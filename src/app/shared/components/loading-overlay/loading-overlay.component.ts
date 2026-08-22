import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { LoadingService } from '@core/services/Utils/loading.service';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  template: `
    @if (loadingService.isLoading()) {
      <div class="loading-overlay" role="status" aria-live="polite" aria-busy="true">
        <div class="loading-overlay__panel flex-column flex-center gap-m">
          <div class="spinner" aria-hidden="true"></div>
          @if (displayMessage()) {
            <p class="loading-overlay__text">{{ displayMessage() }}</p>
          }
          @if (progressPercent() !== null) {
            <div class="loading-overlay__progress-track">
              <div
                class="loading-overlay__progress-bar"
                [style.width.%]="progressPercent()"
              ></div>
            </div>
            <p class="loading-overlay__progress-label">{{ progressLabel() }}</p>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  readonly loadingService = inject(LoadingService);
  message = input<string>('Loading data…');

  displayMessage = computed(
    () => this.loadingService.message() ?? this.message()
  );

  progressLabel = computed(() => this.loadingService.progressLabel());

  progressPercent = computed(() => {
    const p = this.loadingService.progress();
    if (!p || p.total <= 0) return null;
    return Math.min(100, Math.round((p.current / p.total) * 100));
  });
}
