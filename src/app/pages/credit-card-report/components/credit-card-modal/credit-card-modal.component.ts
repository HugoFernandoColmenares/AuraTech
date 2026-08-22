import { Component, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-credit-card-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './credit-card-modal.component.html',
  styleUrl: './credit-card-modal.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditCardModalComponent {
  pendingFileName = input('');
  confirm = output<void>();
  cancel = output<void>();
}
