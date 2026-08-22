import { Injectable, signal, computed } from '@angular/core';
import { ICreditCardTransactionDto } from '@core/interfaces/ICreditCardTransactionDto.interface';
import { generateGuid } from '@core/auxiliar/guid-utils';
import { ExcelHandlerService } from './excel-handler.service';
import { inject } from '@angular/core';
import * as XLSX from 'xlsx';
import { DateUtils } from '@core/auxiliar/date.utils';

import { CreditCardMapLookupService } from '@core/services/Excel/credit-card-map-lookup.service';
import { InsightItem, InsightsReport } from '@core/interfaces/ISaleRecordDto.interface';
import {
  normalizeCreditCardDate,
  normalizeCreditCardRecords,
} from '@core/auxiliar/credit-card-date.util';

@Injectable({
  providedIn: 'root'
})
export class CreditCardReportService {
  private excelHandler = inject(ExcelHandlerService);
  private mapLookup = inject(CreditCardMapLookupService);
  private transactionsData = signal<ICreditCardTransactionDto[]>([]);

  public transactions = computed(() => this.transactionsData());

  /** Replaces session data (e.g. demo JSON load) and runs map-sheet enrichment. */
  async setTransactions(records: ICreditCardTransactionDto[]): Promise<void> {
    await this.mapLookup.ensureLoaded();
    // Server data must not overwrite pending local session rows (unsaved uploads).
    const localPending = this.transactionsData().filter(r => r.isLocal);
    const normalized = normalizeCreditCardRecords(records);
    const localIds = new Set(localPending.map(r => r.id));
    const serverRows = this.enrichData(normalized).filter(r => !localIds.has(r.id));
    this.transactionsData.set([...localPending, ...serverRows]);
  }

  /** Rows imported in this browser session that are not yet in Supabase. */
  getLocalPendingData(): ICreditCardTransactionDto[] {
    return this.transactionsData().filter(r => r.isLocal);
  }

  async appendTransactions(records: ICreditCardTransactionDto[]): Promise<void> {
    await this.mapLookup.ensureLoaded();
    const enriched = this.enrichData(
      normalizeCreditCardRecords(records.map(r => ({ ...r, isLocal: r.isLocal ?? true })))
    );
    this.transactionsData.update(curr => [...curr, ...enriched]);
  }

  public async parseExcelFile(file: File): Promise<void> {
    await this.mapLookup.ensureLoaded();
    const wb = await this.excelHandler.parseToWorkbook(file);
    const sheetName = wb.SheetNames[0];
    const worksheet = wb.Sheets[sheetName];
    if (!worksheet) {
      throw new Error('No sheets found in workbook.');
    }

    // Smart header finding
    const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '' });
    let headerRowIndex = 0;
    const keywords = ['date', 'description', 'amount', 'card member', 'member', 'receipt', 'reference'];
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row)) continue;
      const matchCount = row.filter(cell => {
        const val = String(cell).toLowerCase().trim();
        return keywords.some(k => val.includes(k));
      }).length;
      
      if (matchCount >= 2) {
        headerRowIndex = r;
        break;
      }
    }

    const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: true, defval: '', range: headerRowIndex }) as Record<string, unknown>[];
    const parsed = this.transformData(rawData);
    if (parsed.length === 0) {
      throw new Error('No valid transactions could be parsed from the selected sheet. Ensure columns date, description and amount are present.');
    }
    await this.appendTransactions(parsed);
  }

  private transformData(jsonData: Record<string, unknown>[]): ICreditCardTransactionDto[] {
    const list: ICreditCardTransactionDto[] = [];
    for (const row of jsonData) {
      if (!row || typeof row !== 'object') continue;
      
      const normalizedRow: Record<string, unknown> = {};
      let hasKeys = false;
      for (const [key, value] of Object.entries(row)) {
        const lowerKey = key.trim().toLowerCase();
        normalizedRow[lowerKey] = value;
        if (value !== undefined && value !== null && String(value).trim() !== '') {
          hasKeys = true;
        }
      }
      
      if (!hasKeys) continue;

      // 1. Extracción e Inyección de campos de Auditoría Planos (Soporte Multi-Formato)
      const excelMonth = normalizedRow['month'] !== undefined ? String(normalizedRow['month']).trim() : '';
      const excelYear = normalizedRow['year'] !== undefined ? String(normalizedRow['year']).trim() : '';

      const rawDateStr = String(normalizedRow['date'] || '').trim();
      let auditMonth = excelMonth || '1';
      let auditYear = excelYear || '2024';

      // Parseo seguro de fecha si no vienen los campos de control explícitos
      if ((!excelMonth || !excelYear) && rawDateStr.includes('/')) {
        const segments = rawDateStr.split(' ')[0].split('/');
        if (segments.length === 3) {
          auditMonth = String(parseInt(segments[0], 10)); // Maneja formato local "1" o "01"
          auditYear = segments[2].trim();
        }
      }

      const description = String(normalizedRow['description'] || normalizedRow['transaction description'] || '').trim();
      if (!description) continue;

      // 2. Parseo Numérico de Montos Limpios
      let amount = 0;
      const rawAmount = normalizedRow['amount'] ?? 0;
      if (typeof rawAmount === 'number') {
        amount = rawAmount;
      } else if (rawAmount !== undefined && rawAmount !== null) {
        const parsedAmount = parseFloat(String(rawAmount).replace(/[$\s]/g, '').replace(',', '.'));
        if (!isNaN(parsedAmount)) {
          amount = parsedAmount;
        } else {
          continue; 
        }
      } else {
        continue; 
      }

      const cardMember = String(normalizedRow['card member'] || normalizedRow['name'] || '').trim();

      const parsedDate = DateUtils.parseDate(rawDateStr);
      const safeUtcDate = parsedDate
        ?? new Date(Date.UTC(parseInt(auditYear, 10), parseInt(auditMonth, 10) - 1, 1));

      list.push(normalizeCreditCardDate({
        id: generateGuid(),
        isLocal: true,
        date: safeUtcDate, // Evitamos DateUtils inestables e inyectamos la instancia UTC controlada
        receipt: normalizedRow['receipt'] ? String(normalizedRow['receipt']).trim() : null,
        description,
        cardMember,
        accountNumberSuffix: String(normalizedRow['account #'] || normalizedRow['account'] || '').trim(),
        amount,
        extendedDetails: String(normalizedRow['extended details'] || '').trim(),
        statementDescription: String(normalizedRow['appears on your statement as'] || '').trim(),
        address: String(normalizedRow['address'] || '').trim(),
        cityState: String(normalizedRow['city/state'] || '').trim(),
        zipCode: String(normalizedRow['zip code'] || '').trim(),
        country: String(normalizedRow['country'] || '').trim(),
        referenceNumber: String(normalizedRow['reference'] || normalizedRow['reference #'] || '').trim(),
        
        // Asignamos directamente la categoría e información curada pre-existente en el Excel
        category: normalizedRow['category'] ? String(normalizedRow['category']).trim() : '',
        control: normalizedRow['control #'] ? String(normalizedRow['control #']).trim() : '',
        channel: normalizedRow['channel'] ? String(normalizedRow['channel']).trim() : '',
        
        // Propiedades de auditoría atómicas agregadas a la interfaz extendida del DTO
        auditMonth,
        auditYear,
      }));
    }
    return list;
  }

  private enrichData(data: ICreditCardTransactionDto[]): ICreditCardTransactionDto[] {
    return data.map(t => {
      const enriched = { ...t };
      const mapSheetMatch = this.mapLookup.matchMapSheet(t.description);
      const budgetMatch = !mapSheetMatch ? this.mapLookup.matchBudget(t.description) : undefined;

      if (mapSheetMatch) {
        enriched.dept = mapSheetMatch.dept;
        enriched.salesChannel = mapSheetMatch.salesChannel;
        if (!enriched.control) enriched.control = mapSheetMatch.control;
        if (!enriched.category) enriched.category = mapSheetMatch.category;
      } else if (budgetMatch && !enriched.category) {
        enriched.category = budgetMatch.category;
      }

      if (enriched.control && !enriched.channel) {
        const channelMatch = this.mapLookup.matchChannel(enriched.control);
        if (channelMatch) {
          enriched.channel = channelMatch.channels;
        }
      }

      return enriched;
    });
  }

  public resetData() {
    this.transactionsData.set([]);
  }

  public totalSpend = computed(() => {
    return this.transactions().reduce((acc, t) => acc + t.amount, 0);
  });

  public transactionsByCategory = computed(() => {
    const map = new Map<string, number>();
    this.transactions().forEach(t => {
      const cat = t.category || 'Uncategorized';
      map.set(cat, (map.get(cat) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => ({ category, amount }));
  });

  public transactionsByChannel = computed(() => {
    const map = new Map<string, number>();
    this.transactions().forEach(t => {
      const chan = t.channel || 'Other';
      map.set(chan, (map.get(chan) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([channel, amount]) => ({ channel, amount }));
  });

  public transactionsByDept = computed(() => {
    const map = new Map<string, number>();
    this.transactions().forEach(t => {
      const dept = t.dept || 'General';
      map.set(dept, (map.get(dept) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([dept, amount]) => ({ dept, amount }));
  });

  public transactionsByCardMember = computed(() => {
    const map = new Map<string, number>();
    this.transactions().forEach(t => {
      const member = t.cardMember || 'Unknown';
      map.set(member, (map.get(member) ?? 0) + t.amount);
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([cardMember, amount]) => ({ cardMember, amount }));
  });

  public insightsReport = computed<InsightsReport | null>(() => {
    const data = this.transactions();
    if (!data.length) return null;

    const total = this.totalSpend();
    const categories = this.transactionsByCategory();
    const channels = this.transactionsByChannel();
    const depts = this.transactionsByDept();

    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

    const profitabilityInsights: InsightItem[] = [];
    profitabilityInsights.push({
      icon: '💳',
      title: 'Total Spend',
      body: `Total recorded credit card spend is **${fmt(total)}** across **${data.length}** transactions.`,
      severity: 'info'
    });

    const channelInsights: InsightItem[] = [];
    if (channels.length) {
      const topChan = channels[0];
      const pct = ((topChan.amount / total) * 100).toFixed(1);
      channelInsights.push({
        icon: '🔗',
        title: 'Top Channel',
        body: `The highest spending channel is **${topChan.channel}**, with **${fmt(topChan.amount)}** (${pct}% of total).`,
        severity: 'neutral'
      });
    }

    if (depts.length) {
      const topDept = depts[0];
      const pct = ((topDept.amount / total) * 100).toFixed(1);
      channelInsights.push({
        icon: '🏢',
        title: 'Top Department',
        body: `**${topDept.dept}** department has the highest expenditure: **${fmt(topDept.amount)}** (${pct}%).`,
        severity: 'info'
      });
    }

    const productInsights: InsightItem[] = [];
    if (categories.length) {
      const topCat = categories[0];
      const pct = ((topCat.amount / total) * 100).toFixed(1);
      productInsights.push({
        icon: '📊',
        title: 'Top Category',
        body: `The highest spending category is **${topCat.category}**, accounting for **${fmt(topCat.amount)}** (${pct}% of total spend).`,
        severity: 'neutral'
      });
    }

    return {
      generatedAt: DateUtils.now(),
      totalRecords: data.length,
      sections: {
        profitability: profitabilityInsights,
        channelScope: channelInsights,
        productAffinity: productInsights,
        recommendations: []
      }
    };
  });
}