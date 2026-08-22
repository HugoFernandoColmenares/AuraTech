import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormGroup } from '@angular/forms';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';

export type RecordType = 'sale';
type RecordFormValue = Partial<ISaleRecordDto>;

@Component({
  selector: 'app-record-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './record-form.component.html',
  styleUrls: ['./record-form.component.css'],
})
export class RecordFormComponent {
  private fb = inject(FormBuilder);

  type = input.required<RecordType>();
  record = input<RecordFormValue>();
  mode = input<'view' | 'edit' | 'create'>('view');

  save = output<RecordFormValue>();
  cancel = output<void>();

  form: FormGroup = this.createForm();

  constructor() {
    effect(() => {
      this.type();
      const rec = this.record();
      const mode = this.mode();

      this.form = this.createForm();
      if (rec) {
        this.form.patchValue(rec);
      }
      if (mode === 'view') {
        this.form.disable({ emitEvent: false });
      } else {
        this.form.enable({ emitEvent: false });
      }
    });
  }

  private createForm(): FormGroup {
    return this.fb.group({
      orderId: ['', Validators.required],
      idx: [0],
      orderStatus: [''],
      warehouseCode: [''],
      account: ['', Validators.required],
      channel: [''],
      category: ['Retail', Validators.required],
      orderPlaceDate: [null],
      sku: ['', Validators.required],
      itemCost: [0, [Validators.required, Validators.min(0)]],
      itemQuantity: [0, [Validators.required, Validators.min(0)]],
      total: [0],
      brand: [''],
      collection: [''],
    });
  }

  onSubmit(): void {
    if (this.form.valid) {
      const data = { ...this.form.getRawValue() } as RecordFormValue;
      const rec = this.record();
      if (this.mode() === 'edit' && rec) {
        const source = rec as RecordFormValue & {
          id?: string;
          auditYear?: number | string;
          auditMonth?: number | string;
        };
        const payload = data as RecordFormValue & {
          id?: string;
          auditYear?: number | string;
          auditMonth?: number | string;
        };
        if (source.id) payload.id = source.id;
        if (source.auditYear != null) payload.auditYear = source.auditYear;
        if (source.auditMonth != null) payload.auditMonth = source.auditMonth;
      }
      if (this.mode() === 'create') {
        (data as RecordFormValue & { isLocal?: boolean }).isLocal = true;
      }
      this.save.emit(data);
    } else {
      this.form.markAllAsTouched();
    }
  }
}
