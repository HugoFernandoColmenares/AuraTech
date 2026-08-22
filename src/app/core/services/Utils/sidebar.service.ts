import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SidebarService {
  private _isOpen = signal(false);
  isOpen = this._isOpen.asReadonly();

  toggle() {
    this._isOpen.update(v => !v);
  }

  open() {
    this._isOpen.set(true);
  }

  close() {
    this._isOpen.set(false);
  }
}
