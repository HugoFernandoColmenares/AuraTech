import { Signal, computed } from '@angular/core';
import { DateUtils } from './date.utils';
import { IInventoryRecordDto } from '@core/interfaces/IInventoryRecordDto.interface';
import { InsightItem, InsightsReport } from '@core/interfaces/ISaleRecordDto.interface';
import {
  INVENTORY_PRIORITY_THRESHOLD,
  INVENTORY_URGENT_THRESHOLD,
  isInventoryGood,
  isInventoryPriority,
  isInventoryUrgent,
} from '@core/constants/inventory-thresholds.const';

export function getInventoryInsights(inventoryData: Signal<IInventoryRecordDto[]>): Signal<InsightsReport | null> {
    
    return computed<InsightsReport | null>(() => {
        const data = inventoryData() || []; 
        if (!data.length) return null;

        const totalAvailable = data.reduce((sum: number, d: any) => sum + d.available, 0);
        const totalOnHand = data.reduce((sum: number, d: any) => sum + d.onHand, 0);
        const totalSKUs = data.length;

        // ── Question 1: Total units ─────────────────────────────────────────
        const stockOverview: InsightItem[] = [];
        stockOverview.push({
            icon: '📦',
            title: 'Total Inventory Volume',
            body: `You currently have **${totalAvailable.toLocaleString()} units available** across **${totalSKUs.toLocaleString()} SKUs**. Total On Hand is **${totalOnHand.toLocaleString()} units**. ${totalAvailable > 5000 ? 'Healthy overall stock levels — continue monitoring turnover rates.' : 'Relatively low total stock — review replenishment schedules for critical items.'}`,
            severity: totalAvailable > 5000 ? 'positive' : 'warning'
        });

        // Urgent / Priority breakdown
        const urgentCount = data.filter(d => isInventoryUrgent(d.available)).length;
        const priorityCount = data.filter(d => isInventoryPriority(d.available)).length;
        const goodCount = data.filter(d => isInventoryGood(d.available)).length;
        const urgentPct = ((urgentCount / totalSKUs) * 100).toFixed(1);
        const priorityPct = ((priorityCount / totalSKUs) * 100).toFixed(1);

        stockOverview.push({
            icon: urgentCount > 0 ? '🚨' : '✅',
            title: 'Stock Health Distribution',
            body: `**${urgentCount} SKUs (${urgentPct}%)** are in Urgent status (≤${INVENTORY_URGENT_THRESHOLD} unit). **${priorityCount} SKUs (${priorityPct}%)** are in Priority status (<${INVENTORY_PRIORITY_THRESHOLD} units). **${goodCount} SKUs** are in Good status. ${urgentCount > 0 ? 'Immediate attention needed for urgent items to avoid stockouts.' : 'All items are adequately stocked.'}`,
            severity: urgentCount > 0 ? 'warning' : 'positive'
        });

        // ── Question 2: Where is the most product? (by Source) ──────────────
        const sourceMap = new Map<string, number>();
        data.forEach((d: any) => {
            const src = d.sourceFile || 'Unknown';
            sourceMap.set(src, (sourceMap.get(src) ?? 0) + d.available);
        });
        const sourceEntries = Array.from(sourceMap.entries()).sort((a, b) => b[1] - a[1]);
        const channelInsights: InsightItem[] = [];

        if (sourceEntries.length) {
            const topSource = sourceEntries[0];
            const topSourcePct = totalAvailable > 0 ? ((topSource[1] / totalAvailable) * 100).toFixed(1) : '0';
            channelInsights.push({
                icon: '🏪',
                title: 'Largest Inventory Source',
                body: `**${topSource[0]}** holds the most inventory with **${topSource[1].toLocaleString()} units** (${topSourcePct}% of total available). ${sourceEntries.length > 1 ? `The second largest source is **${sourceEntries[1][0]}** with **${sourceEntries[1][1].toLocaleString()} units**.` : 'This is your only inventory source.'}`,
                severity: 'positive'
            });

            if (sourceEntries.length > 1) {
                const distribution = sourceEntries.length >= 3 ? 'well-distributed' : 'concentrated';
                channelInsights.push({
                    icon: '📊',
                    title: 'Source Distribution',
                    body: `Inventory is spread across **${sourceEntries.length} sources**, which is ${distribution}. ${sourceEntries.length < 3 ? 'Consider diversifying inventory sources to reduce single-point-of-failure risk.' : 'Good spread across multiple sources — keep monitoring relative balances.'}`,
                    severity: sourceEntries.length >= 3 ? 'positive' : 'neutral'
                });
            }
        }

        // ── Question 3: Division with most products ─────────────────────────
        const divisionMap = new Map<string, number>();
        data.forEach((d: any) => {
            const div = d.division || 'None';
            divisionMap.set(div, (divisionMap.get(div) ?? 0) + d.available);
        });
        const divisionEntries = Array.from(divisionMap.entries()).sort((a, b) => b[1] - a[1]);
        const productInsights: InsightItem[] = [];

        if (divisionEntries.length) {
            const topDiv = divisionEntries[0];
            const topDivPct = totalAvailable > 0 ? ((topDiv[1] / totalAvailable) * 100).toFixed(1) : '0';
            productInsights.push({
                icon: '🏷️',
                title: 'Top Division by Volume',
                body: `**${topDiv[0]}** is the division with the highest inventory at **${topDiv[1].toLocaleString()} units** (${topDivPct}% of total). ${divisionEntries.length > 1 ? `Followed by **${divisionEntries[1][0]}** with **${divisionEntries[1][1].toLocaleString()} units**.` : ''} Monitor division-level allocation to avoid overconcentration.`,
                severity: 'info'
            });

            const divisionSKUMap = new Map<string, number>();
            data.forEach((d: any) => {
                const div = d.division || 'None';
                divisionSKUMap.set(div, (divisionSKUMap.get(div) ?? 0) + 1);
            });
            const divSKUEntries = Array.from(divisionSKUMap.entries()).sort((a, b) => b[1] - a[1]);
            const topDivSKU = divSKUEntries[0];
            const topDivSKUPct = totalSKUs > 0 ? ((topDivSKU[1] / totalSKUs) * 100).toFixed(1) : '0';

            productInsights.push({
                icon: '📋',
                title: 'Division SKU Concentration',
                body: `**${topDivSKU[0]}** has the most unique SKUs with **${topDivSKU[1].toLocaleString()} SKUs** (${topDivSKUPct}% of total). ${parseFloat(topDivSKUPct) > 60 ? 'High concentration in a single division — consider balancing the product range.' : 'Healthy distribution of SKUs across divisions.'}`,
                severity: parseFloat(topDivSKUPct) > 60 ? 'warning' : 'positive'
            });
        }

        // ── Question 4: Collection with most On Hand ────────────────────────
        const collectionOnHandMap = new Map<string, number>();
        data.forEach((d: any) => {
            const coll = d.collection || 'N/A';
            collectionOnHandMap.set(coll, (collectionOnHandMap.get(coll) ?? 0) + d.onHand);
        });
        const collectionEntries = Array.from(collectionOnHandMap.entries()).sort((a, b) => b[1] - a[1]);

        if (collectionEntries.length) {
            const topColl = collectionEntries[0];
            const topCollPct = totalOnHand > 0 ? ((topColl[1] / totalOnHand) * 100).toFixed(1) : '0';
            productInsights.push({
                icon: '👗',
                title: 'Top Collection by On Hand',
                body: `The collection with the majority of On Hand inventory is **${topColl[0]}** with **${topColl[1].toLocaleString()} units** (${topCollPct}% of total On Hand). ${collectionEntries.length > 1 ? `Second is **${collectionEntries[1][0]}** with **${collectionEntries[1][1].toLocaleString()} units**.` : ''} Ensure sell-through rates align with this stock investment.`,
                severity: 'info'
            });
        }

        // ── Recommendations ─────────────────────────────────────────────────
        const recommendations: InsightItem[] = [];

        if (urgentCount > 0) {
            recommendations.push({
                icon: '⚡',
                title: 'Restock Urgent Items',
                body: `**${urgentCount} items** have critically low stock (≤1 unit). Prioritize reordering these SKUs to prevent stockouts and lost sales. Review lead times to expedite replenishment.`,
                severity: 'warning'
            });
        }

        if (priorityCount > 0) {
            recommendations.push({
                icon: '📦',
                title: 'Monitor Priority Items',
                body: `**${priorityCount} items** are below the 50-unit threshold. Schedule regular stock reviews and set up automated reorder points for these SKUs to maintain optimal availability.`,
                severity: 'info'
            });
        }

        if (divisionEntries.length >= 2) {
            const topDivShare = totalAvailable > 0 ? (divisionEntries[0][1] / totalAvailable) * 100 : 0;
            if (topDivShare > 50) {
                recommendations.push({
                    icon: '⚖️',
                    title: 'Division Rebalancing',
                    body: `**${divisionEntries[0][0]}** holds over ${topDivShare.toFixed(0)}% of total inventory. Consider redistributing stock across divisions to reduce concentration risk and improve category breadth.`,
                    severity: 'neutral'
                });
            }
        }

        recommendations.push({
            icon: '📋',
            title: 'Data Completeness',
            body: `This report is based on **${totalSKUs.toLocaleString()} SKUs** from **${sourceEntries.length} source${sourceEntries.length !== 1 ? 's' : ''}**. For comprehensive insights, ensure all inventory sources are uploaded and up to date.`,
            severity: 'neutral'
        });

        // ── Retorno final del reporte ───────────────────────────────────────
        return {
            generatedAt: DateUtils.now(),
            totalRecords: totalSKUs,
            sections: {
                profitability: stockOverview,
                channelScope: channelInsights,
                productAffinity: productInsights,
                recommendations
            }
        };
    });
}