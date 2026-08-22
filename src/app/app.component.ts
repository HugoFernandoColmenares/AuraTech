import { Component, ChangeDetectionStrategy, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AppStartupService } from '@core/services/bootstrap/app-startup.service';
import { AlertService } from '@core/services/Utils/alert.service';
import { EnvConfig } from '@core/config/env.config';
import { HealthService } from '@core/services/bootstrap/health.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  private startup = inject(AppStartupService);
  private alertService = inject(AlertService);
  private env = inject(EnvConfig);
  private healthService = inject(HealthService);

  isReady = this.startup.isReady;
  bootMessage = this.startup.bootMessage;

  async ngOnInit(): Promise<void> {
    await this.startup.initialize();

    if (
      this.healthService.useDemoData() &&
      this.env.supabaseConfigured &&
      !sessionStorage.getItem('dbConnectionAlertShown')
    ) {
      this.alertService.databaseConnectionFailed();
      sessionStorage.setItem('dbConnectionAlertShown', 'true');
    }
  }
}
