import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '@shared/header/header.component';
import { SidebarComponent } from '@shared/sidebar/sidebar.component';
import { FooterComponent } from '@shared/footer/footer.component';
import { SidebarService } from '@core/services/Utils/sidebar.service';

@Component({
  selector: 'app-layout',
  imports: [CommonModule, RouterOutlet, HeaderComponent, SidebarComponent, FooterComponent],
  templateUrl: './layout.component.html',
  styleUrl: './layout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayoutComponent {
  sidebarService = inject(SidebarService);
}
