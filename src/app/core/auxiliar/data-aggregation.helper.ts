export function groupAndSum<T>(
  data: T[],
  keyFn: (item: T) => string,
  valFn: (item: T) => number
): { key: string; total: number }[] {
  const map = new Map<string, number>();
  data.forEach(item => {
    const key = keyFn(item);
    map.set(key, (map.get(key) ?? 0) + valFn(item));
  });
  
  return Array.from(map.entries()).map(([key, total]) => ({ key, total }));
}

export function comparePeriods<T>(
  currentData: T[],
  lyData: T[],
  keyFn: (item: T) => string,
  valFn: (item: T) => number
) {
  const mapCurr = new Map<string, number>();
  const mapLY = new Map<string, number>();

  currentData.forEach(item => mapCurr.set(keyFn(item), (mapCurr.get(keyFn(item)) ?? 0) + valFn(item)));
  lyData.forEach(item => mapLY.set(keyFn(item), (mapLY.get(keyFn(item)) ?? 0) + valFn(item)));

  const allKeys = Array.from(new Set([...mapCurr.keys(), ...mapLY.keys()]));
  
  return allKeys.map(name => {
    const currentVal = mapCurr.get(name) ?? 0;
    const lyVal = mapLY.get(name) ?? 0;
    const diff = currentVal - lyVal;
    const pct = lyVal === 0 ? 0 : Number(((diff / lyVal) * 100).toFixed(2));
    return { name, current: currentVal, ly: lyVal, diff, pct };
  }).sort((a, b) => b.current - a.current);
}