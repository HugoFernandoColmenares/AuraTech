import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViewModeOption } from '@core/interfaces/view-controls.interface';

@Component({
  selector: 'app-view-controls',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './view-controls.component.html',
  styleUrl: './view-controls.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewControlsComponent {
  /** Page heading (Playfair Display via .page-title) */
  title = input.required<string>();
  subtitle = input<string>('');
  /** View mode toggle buttons; omit or pass [] to hide toggles */
  options = input<ViewModeOption[]>([]);
  activeMode = input<string>('');
  modeChange = output<string>();
  /** Bottom border under the header block */
  showBorder = input(true);

  onSelect(modeId: string): void {
    if (modeId !== this.activeMode()) {
      this.modeChange.emit(modeId);
    }
  }
}
