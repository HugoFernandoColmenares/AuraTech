import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InsightCardComponent } from './insight-card/insight-card.component';
import { InsightsReport } from '@core/interfaces/ISaleRecordDto.interface';

@Component({
  selector: 'app-insights-report',
  imports: [CommonModule, InsightCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (report()) {
      <section class="insights-container flex-column gap-l">
        <!-- Insights header -->
        <header class="insights-header">
          <div class="insights-title-row">
            <span class="insights-badge">Auto-Generated</span>
            <h2 class="insights-heading">Business Intelligence Report</h2>
          </div>
          <p class="insights-meta">
            Based on <strong>{{ report()!.totalRecords | number }}</strong> records &middot;
            Generated <strong>{{ report()!.generatedAt | date:'MMM d, y, h:mm a' }}</strong>
          </p>
        </header>

        <!-- ── Profitability Trends ──────────────────────────────────────── -->
        @if (report()!.sections.profitability.length) {
          <div class="insights-section flex-column gap-m">
            <h3 class="insights-section-title">
              <span class="section-icon" aria-hidden="true">📈</span> Profitability Trends
            </h3>
            <div class="insight-cards-grid">
              @for (item of report()!.sections.profitability; track item.title) {
                <app-insight-card [item]="item"></app-insight-card>
              }
            </div>
          </div>
        }

        <!-- ── Channel Scope ────────────────────────────────────────────── -->
        @if (report()!.sections.channelScope.length) {
          <div class="insights-section flex-column gap-m">
            <h3 class="insights-section-title">
              <span class="section-icon" aria-hidden="true">🏪</span> Sales by Channel
            </h3>
            <div class="insight-cards-grid">
              @for (item of report()!.sections.channelScope; track item.title) {
                <app-insight-card [item]="item"></app-insight-card>
              }
            </div>
          </div>
        }

        <!-- ── Product Affinity ─────────────────────────────────────────── -->
        @if (report()!.sections.productAffinity.length) {
          <div class="insights-section flex-column gap-m">
            <h3 class="insights-section-title">
              <span class="section-icon" aria-hidden="true">📦</span> Product Affinity
            </h3>
            <div class="insight-cards-grid">
              @for (item of report()!.sections.productAffinity; track item.title) {
                <app-insight-card [item]="item"></app-insight-card>
              }
            </div>
          </div>
        }

        <!-- ── Recommendations ─────────────────────────────────────────── -->
        @if (report()!.sections.recommendations.length) {
          <div class="insights-section insights-section--recommendations flex-column gap-m">
            <h3 class="insights-section-title">
              <span class="section-icon" aria-hidden="true">💡</span> Recommendations
            </h3>
            <div class="recommendations-list flex-column gap-m" role="list">
              @for (item of report()!.sections.recommendations; track item.title) {
                <app-insight-card [item]="item" [isRecommendation]="true"></app-insight-card>
              }
            </div>
          </div>
        }
      </section>
    } @else {
      <p class="insights-empty">No data available. Upload a file first.</p>
    }
  `,
  styleUrl: './insights-report.component.css'
})
export class InsightsReportComponent {
  report = input<InsightsReport | null | undefined>(null);
}
