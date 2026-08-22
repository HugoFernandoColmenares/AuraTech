export function groupAndSumByKey(data: any[], groupKey: string, sumKey: string) {
  const map = new Map<string, number>();
  data.forEach(item => {
    const key = item[groupKey] || 'N/A'; // o 'None' dependiendo del caso
    map.set(key, (map.get(key) ?? 0) + item[sumKey]);
  });
  return {
    labels: Array.from(map.keys()),
    values: Array.from(map.values())
  };
}