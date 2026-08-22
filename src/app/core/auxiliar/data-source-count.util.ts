export interface DataSourceCounts {
  local: number;
  database: number;
}

/** Count rows flagged as browser-session imports vs persisted database rows. */
export function countByDataSource<T extends { isLocal?: boolean }>(rows: T[]): DataSourceCounts {
  return rows.reduce(
    (acc, row) => {
      if (row.isLocal) {
        acc.local += 1;
      } else {
        acc.database += 1;
      }
      return acc;
    },
    { local: 0, database: 0 }
  );
}

/** Server-paginated tables: local rows live in memory; database total comes from API meta. */
export function resolveReportDataSourceCounts(options: {
  hasLocalSession: boolean;
  sessionRows: { isLocal?: boolean }[];
  databaseTotal: number;
}): DataSourceCounts {
  if (options.hasLocalSession) {
    return countByDataSource(options.sessionRows);
  }

  return { local: 0, database: options.databaseTotal };
}
