import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-data-source-indicator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-source-indicator.component.html',
  styleUrl: './data-source-indicator.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataSourceIndicatorComponent {
  localCount = input(0);
  databaseCount = input(0);

  panelOpen = signal(false);

  mode = computed(() => {
    const local = this.localCount();
    const database = this.databaseCount();

    if (local > 0 && database > 0) return 'mixed';
    if (local > 0) return 'session';
    if (database > 0) return 'database';
    return 'empty';
  });

  summaryLabel = computed(() => {
    switch (this.mode()) {
      case 'session':
        return 'Session data';
      case 'database':
        return 'Database data';
      case 'mixed':
        return 'Mixed sources';
      default:
        return 'No data loaded';
    }
  });

  togglePanel(): void {
    this.panelOpen.update(open => !open);
  }

  closePanel(): void {
    this.panelOpen.set(false);
  }
}
