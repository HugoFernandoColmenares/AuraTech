import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './auth.html',
  styleUrl: './auth.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auth {}
