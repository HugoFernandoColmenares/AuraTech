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
        'Start in Sales Report to upload a generic Excel template or map your own columns with Custom Excel.',
      icon: '📂',
      link: '/layout/sales-report',
      linkLabel: 'Open Sales Report',
    },
    {
      step: 2,
      title: 'Upload an Excel file',
      description:
        'Switch to the Data table view and click Upload Data. Select the correct store or account format when prompted—or choose Custom Excel to map your own column layout. Parsed rows stay in your browser session until you export them.',
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
      uploadHint: 'Generic template plus Custom Excel mapping for non-standard layouts.',
    },
    {
      title: 'Products',
      path: '/layout/products',
      uploadHint: 'Product catalog Excel import and manual CRUD.',
    },
  ];
}
