import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-report-upload-placeholder',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './report-upload-placeholder.component.html',
  styleUrl: './report-upload-placeholder.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportUploadPlaceholderComponent {
  icon = input('📊');
  title = input.required<string>();
  description = input.required<string>();
  buttonLabel = input('Browse Files...');
  clickable = input(true);

  browse = output<void>();

  onActivate(event: Event): void {
    if (!this.clickable()) return;
    event.preventDefault();
    this.browse.emit();
  }
}
