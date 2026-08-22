import { Component, ElementRef, input, OnDestroy, ViewChild, ChangeDetectionStrategy, effect } from '@angular/core';
import Chart, { ChartConfiguration, ChartTypeRegistry, Plugin } from 'chart.js/auto';

/**
 * Helper to determine if black or white text should be used based on background color.
 */
function getContrastColor(hexColor: any): string {
  if (!hexColor || typeof hexColor !== 'string') return '#37474F';
  
  let r = 0, g = 0, b = 0;
  if (hexColor.startsWith('#')) {
    if (hexColor.length === 4) {
      r = parseInt(hexColor[1] + hexColor[1], 16);
      g = parseInt(hexColor[2] + hexColor[2], 16);
      b = parseInt(hexColor[3] + hexColor[3], 16);
    } else if (hexColor.length === 7) {
      r = parseInt(hexColor.substring(1, 3), 16);
      g = parseInt(hexColor.substring(3, 5), 16);
      b = parseInt(hexColor.substring(5, 7), 16);
    }
  } else if (hexColor.startsWith('rgba')) {
    const match = hexColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      r = parseInt(match[1]);
      g = parseInt(match[2]);
      b = parseInt(match[3]);
    }
  }

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#37474F' : '#FFFFFF';
}

/**
 * Custom Chart.js plugin to draw data labels directly on the canvas.
 */
const dataLabelsPlugin: Plugin = {
  id: 'customDataLabels',
  afterDatasetsDraw(chart, _args, options) {
    const { ctx } = chart;
    const { 
      enabled = true, 
      font = 'bold 12px sans-serif', 
      color = 'auto', 
      offset = 8, 
      format = 'number' 
    } = options;

    if (!enabled) return;

    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, i) => {
      const meta = chart.getDatasetMeta(i);
      
      meta.data.forEach((element, index) => {
        const dataValue = dataset.data[index];
        if (dataValue === null || dataValue === undefined || dataValue === 0) return;

        const { x, y } = element.tooltipPosition(true);
        
        if (color === 'auto') {
          const bgColor = (element.options as any).backgroundColor || (dataset as any).backgroundColor;
          ctx.fillStyle = getContrastColor(bgColor);
        } else {
          ctx.fillStyle = color;
        }

        let label = String(dataValue);
        if (format === 'currency') {
          label = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(dataValue));
        } else if (format === 'number') {
          label = new Intl.NumberFormat('en-US').format(Number(dataValue));
        }

        let posX = x;
        let posY = y;
        const chartType = (chart.config as any).type as string;

        if (chartType === 'bar') {
          const isHorizontal = (chart.config.options as any)?.indexAxis === 'y';
          if (isHorizontal) {
            ctx.textAlign = 'left';
            posX += offset;
          } else {
            posY = (posY ?? 0) - offset;
          }
        } else if (chartType === 'line') {
          posY = (posY ?? 0) - offset;
        }

        ctx.fillText(label, posX ?? 0, posY ?? 0);
      });
    });
    ctx.restore();
  }
};

@Component({
  selector: 'app-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="chart-container">
      <canvas #chartCanvas aria-label="Data chart" role="img"></canvas>
    </div>
  `,
  styles: [`
    .chart-container {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: inherit;
    }
    canvas {
      width: 100% !important;
      height: 100% !important;
    }
  `]
})
export class ChartComponent implements OnDestroy {
  @ViewChild('chartCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  
  type = input<keyof ChartTypeRegistry>('line');
  data = input<any>();
  options = input<any>();

  private chartInstance: Chart | null = null;

  constructor() {
    effect(() => {
      this.renderChart();
    });
  }

  ngOnDestroy(): void {
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
  }

  private renderChart(): void {
    if (!this.canvasRef || !this.data()) return;

    if (this.chartInstance) {
      this.chartInstance.destroy();
      this.chartInstance = null;
    }

    const config: ChartConfiguration = {
      type: this.type(),
      data: this.data(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        ...this.options()
      },
      plugins: [dataLabelsPlugin]
    };

    this.chartInstance = new Chart(this.canvasRef.nativeElement, config);
  }
}
