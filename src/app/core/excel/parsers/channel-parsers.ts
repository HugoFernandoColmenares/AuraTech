import { parseDecimalLocale } from '@core/auxiliar/excel-parse.utils';
import { generateGuid } from '@core/auxiliar/guid-utils';
import { findReferenceByParent } from '@core/auxiliar/reference-lookup.utils';
import { ISaleRecordDto } from '@core/interfaces/ISaleRecordDto.interface';
import { SalesParserContext } from '../sales-parser.context';

export function parseGenericSales(jsonData: Record<string, unknown>[], ctx: SalesParserContext): ISaleRecordDto[] {
  return jsonData.map((row: Record<string, unknown>, idx: number) => {
    const rawSku = String(row['sku'] || '').trim();
    const itemCost = parseDecimalLocale(row['itemCost']);
    const itemQuantity = parseDecimalLocale(row['itemQuantity']);
    const account = String(row['Account'] || row['account'] || 'Generic Account').trim();
    const orderId = String(row['PO#'] || row['orderId'] || '').trim();
    const brandInFile = String(row['Brand'] || '').trim();

    const excelMonth =
      row['MONTH'] !== undefined && row['MONTH'] !== null
        ? String(row['MONTH']).trim()
        : row['auditMonth'] !== undefined && row['auditMonth'] !== null
          ? String(row['auditMonth']).trim()
          : '';

    const excelYear =
      row['YEAR'] !== undefined && row['YEAR'] !== null
        ? String(row['YEAR']).trim()
        : row['auditYear'] !== undefined && row['auditYear'] !== null
          ? String(row['auditYear']).trim()
          : '';

    const excelWeek =
      row['WEEK'] !== undefined && row['WEEK'] !== null
        ? String(row['WEEK']).trim()
        : row['channel'] !== undefined &&
            row['channel'] !== null &&
            String(row['channel']).startsWith('W')
          ? String(row['channel']).substring(1).trim()
          : '';

    const rawExcelTotal = row['total  ( J*I)'] || row['total'];
    let total = parseDecimalLocale(rawExcelTotal);

    if (total === 0 && itemCost > 0) {
      total = itemCost * itemQuantity;
    }

    let brand = brandInFile || 'Unknown';
    let collection = 'None';

    if (rawSku) {
      const parent = rawSku.split('-')[0];
      const matched = findReferenceByParent(ctx.referenceList, parent);
      if (matched) {
        if (!brandInFile || brandInFile === 'Unknown') {
          brand = matched.brand || 'Unknown';
        }
        collection = matched.collection || 'None';
      }
    }

    let safeUtcDate: Date | null = null;
    if (excelYear && excelMonth) {
      const y = parseInt(excelYear, 10);
      const m = parseInt(excelMonth, 10) - 1;
      if (!isNaN(y) && !isNaN(m) && m >= 0 && m <= 11) {
        safeUtcDate = new Date(Date.UTC(y, m, 1));
      }
    }

    return {
      id: `GEN-${String(idx)}-${generateGuid()}`,
      isLocal: true,
      orderId,
      idx,
      orderStatus: 'Processed',
      warehouseCode: 'GEN',
      orderPlaceDate: safeUtcDate,
      sku: rawSku,
      itemCost: Number(itemCost.toFixed(2)),
      itemQuantity,
      account,
      category: 'Retail',
      total: Number(total.toFixed(2)),
      brand,
      collection,
      auditMonth: excelMonth,
      auditYear: excelYear,
      channel: excelWeek ? `W${excelWeek}` : undefined,
    } satisfies ISaleRecordDto;
  });
}
