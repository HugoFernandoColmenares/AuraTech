/**
 * Mapping between a {@link ISaleRecordDto} property and the Excel column that
 * provides its value. Keys are ISaleRecordDto field names; values are the
 * (normalized, duplicate-safe) Excel header text.
 *
 * Optional fields may be left unset when the source file does not contain them.
 */
export interface ISaleRecordMappingProperties {
  orderId: string;
  sku: string;
  itemCost: string;
  itemQuantity: string;
  orderPlaceDate: string;
  total: string;
}

/**
 * A reusable custom Excel mapping template.
 *
 * Stored in the `excel_mappings` table (shared across authenticated users).
 * The base API service converts camelCase ↔ snake_case automatically
 * (accountName ↔ account_name, sheetName ↔ sheet_name, propertiesMap ↔
 * properties_map, dateFormat ↔ date_format).
 */
export interface IExcelMappingDto {
  id?: string;
  /** Unique display name, e.g. "Walmart WFS Alternative" or "Faire Custom". */
  accountName: string;
  /** Exact worksheet tab name to read, e.g. "WFS". */
  sheetName: string;
  category: 'Retail' | 'Wholesale';
  propertiesMap: ISaleRecordMappingProperties;
  /** Optional date parser hint, e.g. "DD/MM/YYYY" or "MM-DD-YYYY". */
  dateFormat?: string;
  /**
   * Manual audit month (1–12) applied to every imported row when the Excel
   * file has no month column. Matches {@link ISaleRecordDto.auditMonth}.
   */
  auditMonth?: number;
  /**
   * Manual audit year applied to every imported row when the Excel file has no
   * year column. Matches {@link ISaleRecordDto.auditYear}.
   */
  auditYear?: number;
}
