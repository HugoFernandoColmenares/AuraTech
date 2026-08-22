import { Injectable } from '@angular/core';

export const GLOBAL_CHART_COLORS = [
  '#D81B60', // Raspberry (Primary)
  '#1A237E', // Midnight Blue (Tertiary)
  '#006064', // Deep Teal
  '#1B5E20', // Emerald
  '#FFD600', // Amber Gold
  '#4527A0', // Deep Purple
  '#0277BD', // Light Blue
  '#C2185B', // Dark Pink
  '#2E7D32', // Medium Green
  '#37474F'  // Blue Grey
];

@Injectable({
  providedIn: 'root'
})
export class ChartGeneratorService {
  
  generateLineChart(labels: string[], datasets: any[], options: Record<string, any> = {}) {
    return {
      type: 'line' as 'line',
      data: {
        labels,
        datasets
      },
      options: { responsive: true, maintainAspectRatio: false, ...options }
    };
  }

  generateBarChart(labels: string[], data: number[], labelName: string, isHorizontal: boolean = false, overrideColors?: string[], options: Record<string, any> = {}) {
    const baseOptions: Record<string, any> = { responsive: true, maintainAspectRatio: false };
    if (isHorizontal) {
      baseOptions['indexAxis'] = 'y';
      baseOptions['plugins'] = { legend: { display: false } };
    }
    
    return {
      type: 'bar' as 'bar',
      data: {
        labels,
        datasets: [{
          label: labelName,
          data,
          backgroundColor: overrideColors || GLOBAL_CHART_COLORS,
          borderRadius: 4
        }]
      },
      options: { ...baseOptions, ...options }
    };
  }

  generatePieChart(labels: string[], data: number[], options: Record<string, any> = {}) {
    return {
      type: 'pie' as 'pie',
      data: {
        labels,
        datasets: [{ data, backgroundColor: GLOBAL_CHART_COLORS }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } },
        ...options
      }
    };
  }

  generateDoughnutChart(labels: string[], data: number[], options: Record<string, any> = {}) {
    return {
      type: 'doughnut' as 'doughnut',
      data: {
        labels,
        datasets: [{ data, backgroundColor: GLOBAL_CHART_COLORS }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right' } },
        ...options
      }
    };
  }
}
