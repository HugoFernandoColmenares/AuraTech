import { Component, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface GuideSection {
  id: string;
  title: string;
  isOpen: boolean;
}

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
})
export class AboutComponent {
  sections = signal<GuideSection[]>([
    { id: 'dashboard', title: 'Dashboard & Getting Started', isOpen: true },
    { id: 'upload-workflow', title: 'Data Upload Workflow (Detailed)', isOpen: false },
    { id: 'custom-excel', title: 'Custom Excel Mapping (Sales)', isOpen: false },
    { id: 'export-db', title: 'Export to Database', isOpen: false },
    { id: 'data-sources', title: 'Session vs Database Rows', isOpen: false },
    { id: 'sales-reporting', title: 'Sales Reporting & Ingestion', isOpen: false },
    { id: 'catalog', title: 'Product Catalog', isOpen: false },
    { id: 'management', title: 'Product Management', isOpen: false },
    { id: 'credits', title: 'Developer Credits', isOpen: false },
  ]);

  toggleSection(id: string): void {
    this.sections.update(prev =>
      prev.map(section => ({
        ...section,
        isOpen: section.id === id ? !section.isOpen : section.isOpen,
      }))
    );
  }
}
