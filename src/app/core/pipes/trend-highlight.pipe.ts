import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'trendHighlight',
  standalone: true
})
export class TrendHighlightPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    if (value === undefined || value === null || value === 0) return 'trend-neutral';
    return value > 0 ? 'trend-positive' : 'trend-negative';
  }
}
