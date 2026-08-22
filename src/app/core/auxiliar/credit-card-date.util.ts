import { DateUtils } from '@core/auxiliar/date.utils';
import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';

export interface CreditCardAuditFields {
  auditMonth?: number | string;
  auditYear?: number | string;
}

function parseAuditYear(record: CreditCardAuditFields): number | null {
  if (record.auditYear == null || String(record.auditYear).trim() === '') return null;
  const year = parseInt(String(record.auditYear), 10);
  return !Number.isNaN(year) && year > 1900 ? year : null;
}

function parseAuditMonthIndex(record: CreditCardAuditFields): number | null {
  if (record.auditMonth == null || String(record.auditMonth).trim() === '') return null;
  const month = parseInt(String(record.auditMonth), 10);
  return !Number.isNaN(month) && month >= 1 && month <= 12 ? month - 1 : null;
}

/** Normalizes credit-card transaction dates; statement audit month/year take precedence. */
export function normalizeCreditCardDate(
  record: ICreditCardTransactionDto & CreditCardAuditFields
): ICreditCardTransactionDto {
  const auditYear = parseAuditYear(record);
  const auditMonth = parseAuditMonthIndex(record);
  let date = DateUtils.parseDate(record.date);

  if (auditYear != null && auditMonth != null) {
    const day = date ? date.getUTCDate() : 1;
    date = new Date(Date.UTC(auditYear, auditMonth, day));
  } else if (!date) {
    date = new Date();
  }

  return { ...record, date };
}

export function normalizeCreditCardRecords(
  records: (ICreditCardTransactionDto & CreditCardAuditFields)[]
): ICreditCardTransactionDto[] {
  return records.map(normalizeCreditCardDate);
}

/** Statement year — prefers auditYear over transaction date. */
export function getCreditCardYear(
  record: ICreditCardTransactionDto & CreditCardAuditFields
): number {
  return parseAuditYear(record) ?? DateUtils.getYearKey(record.date);
}

/** Statement month index 0–11 — prefers auditMonth over transaction date. */
export function getCreditCardMonth(
  record: ICreditCardTransactionDto & CreditCardAuditFields
): number {
  return parseAuditMonthIndex(record) ?? DateUtils.getMonthKey(record.date);
}

/** Sort key: year * 12 + month (0–11). */
export function getCreditCardYearMonthOrdinal(
  record: ICreditCardTransactionDto & CreditCardAuditFields
): number {
  return getCreditCardYear(record) * 12 + getCreditCardMonth(record);
}

export function compareCreditCardDatesDesc(
  a: ICreditCardTransactionDto,
  b: ICreditCardTransactionDto
): number {
  const ta = DateUtils.parseDate(a.date)?.getTime() ?? 0;
  const tb = DateUtils.parseDate(b.date)?.getTime() ?? 0;
  return tb - ta;
}

export function previousStatementMonth(
  year: number,
  monthIndex: number
): { year: number; monthIndex: number } {
  if (monthIndex === 0) return { year: year - 1, monthIndex: 11 };
  return { year, monthIndex: monthIndex - 1 };
}
