import { Component, input, output, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pagination',
  standalone: true,
  imports: [CommonModule],
  template: `
    <nav class="pagination" aria-label="Pagination navigation">
      <div class="pagination-info" aria-live="polite">
        Page <strong>{{ currentPage() }}</strong> of {{ totalPages() }}
      </div>
      <div class="pagination-controls">
        <button 
          class="page-btn" 
          (click)="goToPage(currentPage() - 1)" 
          [disabled]="currentPage() === 1"
          aria-label="Previous page"
        >
          &lsaquo;
        </button>
        
        @for (p of pageNumbers(); track $index) {
          @if (p === '...') {
            <span class="page-ellipsis" aria-hidden="true">...</span>
          } @else {
            <button 
              class="page-btn" 
              [class.active]="p === currentPage()" 
              (click)="goToPage(p)"
              [attr.aria-current]="p === currentPage() ? 'page' : null"
              [attr.aria-label]="'Go to page ' + p"
            >
              {{ p }}
            </button>
          }
        }
        
        <button 
          class="page-btn" 
          (click)="goToPage(currentPage() + 1)" 
          [disabled]="currentPage() === totalPages()"
          aria-label="Next page"
        >
          &rsaquo;
        </button>
      </div>
    </nav>
  `,
  styleUrls: ['./pagination.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaginationComponent {
  currentPage = input.required<number>();
  totalPages = input.required<number>();
  pageChange = output<number>();

  pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | string)[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      
      for (let i = start; i <= end; i++) pages.push(i);
      
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  });

  goToPage(page: number | string) {
    if (typeof page === 'number' && page >= 1 && page <= this.totalPages() && page !== this.currentPage()) {
      this.pageChange.emit(page);
    }
  }
}
