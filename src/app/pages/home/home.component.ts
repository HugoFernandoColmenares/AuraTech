import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  icon: string;
  link?: string;
  linkLabel?: string;
}

interface ReportModule {
  title: string;
  path: string;
  uploadHint: string;
}

@Component({
  selector: 'app-home',
  imports: [RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  readonly workflowSteps: WorkflowStep[] = [
    {
      step: 1,
      title: 'Open Sales Report',
      description:
        'Start in Sales Report. Upload any Excel file — Custom Excel lets you map columns to sales fields without a fixed template.',
      icon: '📂',
      link: '/layout/sales-report',
      linkLabel: 'Open Sales Report',
    },
    {
      step: 2,
      title: 'Upload an Excel file',
      description:
        'Switch to the Data table view and click Upload Data. Map the worksheet columns, preview rows, then load them into your browser session until you export.',
      icon: '📤',
    },
    {
      step: 3,
      title: 'Review session vs database rows',
      description:
        'Use the data-source icon in the table toolbar. Session rows are marked as pending; database rows are already stored in Supabase.',
      icon: '🔍',
    },
    {
      step: 4,
      title: 'Export session data to the database',
      description:
        'When session rows are present, Export to DB becomes active. Click it to bulk-upload pending records. After a successful export, analytics and tables refresh from Supabase.',
      icon: '☁️',
    },
    {
      step: 5,
      title: 'Explore the catalog (optional)',
      description:
        'Use Products to review a simple catalog. This demo does not include internal data-management tools.',
      icon: '📦',
      link: '/layout/products',
      linkLabel: 'Open Products',
    },
  ];

  readonly reportModules: ReportModule[] = [
    {
      title: 'Sales Report',
      path: '/layout/sales-report',
      uploadHint: 'Map any Excel layout with Custom Excel, then review analytics and persist rows.',
    },
    {
      title: 'Products',
      path: '/layout/products',
      uploadHint: 'Manual catalog of SKUs, brands, and collections used when reviewing sales.',
    },
  ];
}
