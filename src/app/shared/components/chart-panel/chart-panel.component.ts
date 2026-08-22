import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-chart-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './chart-panel.component.html',
  styleUrl: './chart-panel.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartPanelComponent {
  padded = input(true);
  /** When false, only the body slot is rendered (simple analytics panels) */
  showHeader = input(true);
}
