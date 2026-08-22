import {
  Directive,
  Input,
  TemplateRef,
  ViewContainerRef,
  inject,
  effect,
  DestroyRef,
} from '@angular/core';
import { RolePermissionService } from '@core/services/auth/role-permission.service';
import { AppPermission } from '@core/constants/permissions.const';

/**
 * Structural directive: renders content only when the current user has the permission.
 * Usage: `@if (*appHasPermission="'create'")` or `*appHasPermission="'delete'; else denied"`.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly permissions = inject(RolePermissionService);
  private readonly destroyRef = inject(DestroyRef);

  private required: AppPermission | AppPermission[] = 'read';
  private hasView = false;

  @Input()
  set appHasPermission(value: AppPermission | AppPermission[]) {
    this.required = value;
    this.updateView();
  }

  constructor() {
    effect(() => {
      this.permissions.permissions();
      this.updateView();
    });

    this.destroyRef.onDestroy(() => this.viewContainer.clear());
  }

  private updateView(): void {
    const allowed = Array.isArray(this.required)
      ? this.required.some(p => this.permissions.can(p))
      : this.permissions.can(this.required);

    if (allowed && !this.hasView) {
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!allowed && this.hasView) {
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
