import { Injectable } from '@angular/core';
import Swal, { SweetAlertResult } from 'sweetalert2';

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  /** Access to SweetAlert2 instance for advanced use cases */
  public readonly Swal = Swal;

  /**
   * Shows a success message
   * @param title Message title
   * @param text Descriptive text
   */
  success(title: string, text: string = ''): void {
    Swal.fire({
      icon: 'success',
      title,
      text,
      confirmButtonColor: '#0f766e', // Según DESIGN_GUIDELINES.md (Purple)
      timer: 3000,
      timerProgressBar: true
    });
  }

  /**
   * Shows an error message
   * @param title Message title
   * @param text Descriptive text
   */
  error(title: string, text: string = ''): void {
    Swal.fire({
      icon: 'error',
      title,
      text,
      confirmButtonColor: '#000000' // Según DESIGN_GUIDELINES.md (Black)
    });
  }

  /**
   * Shows a warning message
   * @param title Message title
   * @param text Descriptive text
   */
  warning(title: string, text: string = ''): void {
    Swal.fire({
      icon: 'warning',
      title,
      text,
      confirmButtonColor: '#0f766e'
    });
  }

  /**
   * Shows an info message
   * @param title Message title
   * @param text Descriptive text
   */
  info(title: string, text: string = ''): void {
    Swal.fire({
      icon: 'info',
      title,
      text,
      confirmButtonColor: '#0f766e'
    });
  }

  productUnitsBreakdown(
    productName: string,
    byColor: { label: string; units: number }[],
    bySize: { label: string; units: number }[],
    bySizeColor: { label: string; units: number }[]
  ): void {
    const list = (items: { label: string; units: number }[]) =>
      items.length
        ? items
            .map(i => `<li style="display:flex; justify-content:space-between; padding: 0.4rem 0; border-bottom: 1px solid #f0f0f0;">
                <span style="font-weight:600;">${i.label}</span>
                <span style="color:#134e4a; font-weight:700;">${i.units.toLocaleString('en-US')} units</span>
              </li>`)
            .join('')
        : '<li>No data</li>';

    Swal.fire({
      title: productName,
      html: `
        <div style="font-family:'Figtree',sans-serif; text-align:left;">
          <div style="display:flex; gap: 0.5rem; margin-bottom: 1.5rem; justify-content:center;">
             <button id="btn-color" class="swal-filter-btn active">Account</button>
             <button id="btn-size" class="swal-filter-btn">Brand</button>
             <button id="btn-sc" class="swal-filter-btn">Collection</button>
          </div>
          <div id="breakdown-content" style="max-height: 350px; overflow-y: auto; padding-right: 0.5rem;">
            <ul style="list-style:none; padding:0; margin:0;">${list(byColor)}</ul>
          </div>
        </div>
        <style>
          .swal-filter-btn {
            background: #f0f0f0; border: 1px solid #ddd; padding: 0.4rem 0.8rem; border-radius: 2rem;
            cursor: pointer; font-family: 'Figtree', sans-serif; font-size: 0.75rem; font-weight: 700;
            transition: all 0.2s; color: #666;
          }
          .swal-filter-btn.active {
            background: #134e4a; color: white; border-color: #134e4a;
          }
        </style>
      `,
      didOpen: () => {
        const content = document.getElementById('breakdown-content');
        const btns = {
          color: document.getElementById('btn-color'),
          size: document.getElementById('btn-size'),
          sc: document.getElementById('btn-sc')
        };

        const update = (items: { label: string; units: number }[], activeId: string) => {
          if (content) content.innerHTML = `<ul style="list-style:none; padding:0; margin:0;">${list(items)}</ul>`;
          Object.values(btns).forEach(b => b?.classList.remove('active'));
          document.getElementById(activeId)?.classList.add('active');
        };

        btns.color?.addEventListener('click', () => update(byColor, 'btn-color'));
        btns.size?.addEventListener('click', () => update(bySize, 'btn-size'));
        btns.sc?.addEventListener('click', () => update(bySizeColor, 'btn-sc'));
      },
      icon: 'info',
      confirmButtonText: 'Close',
      confirmButtonColor: '#134e4a',
      width: 500,
    });
  }

  /**
   * Shows a confirmation message
   * @param title Question title
   * @param text Descriptive text
   * @returns Promise with the confirmation result
   */
  async confirm(title: string, text: string = ''): Promise<SweetAlertResult> {
    return Swal.fire({
      title,
      text,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#0f766e',
      cancelButtonColor: '#94a3b8', // Silver/Chrome
      confirmButtonText: 'Yes, continue',
      cancelButtonText: 'Cancel'
    });
  }

  inventoryAlert(
    totalSKUs: number,
    total: number,
    totalOnHand: number,
    urgent: number,
    priority: number,
    urgentThreshold: number,
    priorityThreshold: number
  ): Promise<SweetAlertResult> {

    return Swal.fire({
      title: 'Inventory Status',
      html: `
        <div style="text-align: left; font-family: 'Figtree', sans-serif; font-size: 0.9rem; line-height: 1.8;">
          <p style="border-bottom: 1px solid #eee; padding-bottom: 0.5rem;">
            <strong style="font-size: 1.5rem; color: #134e4a;">${totalSKUs.toLocaleString()}</strong> total SKUs loaded
          </p>
          <p>
            📦 <strong>${total.toLocaleString()}</strong> total units <strong>Available</strong>
          </p>
          <p>
            🏷️ <strong>${totalOnHand.toLocaleString()}</strong> total units <strong>On Hand</strong>
          </p>
          <hr style="border: none; border-top: 1px solid #eee;">
          <p>
            🚨 <strong style="color: #0f766e;">${urgent}</strong> items are <strong>Urgent</strong> (≤${urgentThreshold} units available)
          </p>
          <p>
            ⚠️ <strong style="color: #E65100;">${priority}</strong> items are <strong>Priority</strong> (<${priorityThreshold} units available)
          </p>
        </div>
      `,
      icon: urgent > 0 ? 'warning' : 'info',
      confirmButtonText: 'Understood',
      confirmButtonColor: '#0f766e',
      width: 480
    });
  }

  databaseConnectionFailed(): void {
    this.error(
      'Database connection failed',
      'Could not connect to the database. Verify Supabase is available and your network connection, then try again.'
    );
  }

  exportEmpty(entityLabel: string): void {
    this.warning('Nothing to export', `No ${entityLabel} available to export.`);
  }

  exportComplete(entityLabel: string, count: number): void {
    this.success(
      'Export complete',
      `${count.toLocaleString('en-US')} ${entityLabel} exported to Excel.`
    );
  }

  /**
   * Shows a loading message
   * @param title Message title
   */
  loading(title: string = 'Loading...'): void {
    Swal.fire({
      title,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      }
    });
  }

  /**
   * Closes any open alert
   */
  close(): void {
    Swal.close();
  }
}
