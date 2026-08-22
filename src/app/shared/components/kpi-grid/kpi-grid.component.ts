import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type KpiGridColumns = 'auto' | 1 | 2 | 3 | 4;

@Component({
  selector: 'app-kpi-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './kpi-grid.component.html',
  styleUrl: './kpi-grid.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KpiGridComponent {
  /** Column layout; `auto` uses responsive CSS grid */
  columns = input<KpiGridColumns>('auto');
  /** Optional compact padding for nested layouts */
  compact = input(false);
}
