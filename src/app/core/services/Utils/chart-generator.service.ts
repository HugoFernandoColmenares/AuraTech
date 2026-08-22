import { Injectable } from '@angular/core';

export const GLOBAL_CHART_COLORS = [
  '#0f766e',
  '#1d4ed8',
  '#0e7490',
  '#3f6212',
  '#b45309',
  '#334155',
  '#0369a1',
  '#115e59',
  '#4d7c0f',
  '#475569'
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
