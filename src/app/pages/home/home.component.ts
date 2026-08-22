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
      title: 'Open a report module',
      description:
        'Go to Sales Report, Inventory, Credit Card Report, Products, or Reference Sheet depending on the dataset you need to manage.',
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
      title: 'Verify connectivity (optional)',
      description:
        'Administrators can open Data Management to test the database connection, run sales curation, or refresh analytics materialized views.',
      icon: '🔌',
      link: '/layout/data-management',
      linkLabel: 'Data Management',
    },
  ];

  readonly reportModules: ReportModule[] = [
    {
      title: 'Sales Report',
      path: '/layout/sales-report',
      uploadHint: 'Preset store formats plus Custom Excel mapping for non-standard layouts.',
    },
    {
      title: 'Inventory',
      path: '/layout/inventory',
      uploadHint: 'Inventory dashboards and warehouse-specific stock files.',
    },
    {
      title: 'Credit Card Report',
      path: '/layout/credit-card-report',
      uploadHint: 'Amex or corporate card statement spreadsheets.',
    },
    {
      title: 'Products',
      path: '/layout/products',
      uploadHint: 'Product catalog Excel import and manual CRUD.',
    },
    {
      title: 'Reference Sheet',
      path: '/layout/reference-sheet',
      uploadHint: 'Master style reference used across sales parsing.',
    },
  ];
}
