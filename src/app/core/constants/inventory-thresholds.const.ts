/** Single source for inventory stock-status thresholds (urgent / priority / good). */
export const INVENTORY_URGENT_THRESHOLD = 1;
export const INVENTORY_PRIORITY_THRESHOLD = 50;

export function isInventoryUrgent(available: number): boolean {
  return available <= INVENTORY_URGENT_THRESHOLD;
}

export function isInventoryPriority(available: number): boolean {
  return available > INVENTORY_URGENT_THRESHOLD && available < INVENTORY_PRIORITY_THRESHOLD;
}

export function isInventoryGood(available: number): boolean {
  return available >= INVENTORY_PRIORITY_THRESHOLD;
}
