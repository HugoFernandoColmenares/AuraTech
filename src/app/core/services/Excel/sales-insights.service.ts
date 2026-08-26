import { Injectable, computed, inject } from '@angular/core';
import { DateUtils } from '@core/auxiliar/date.utils';
import { SalesProcessingService } from './sales-processing.service';
import { ProductService } from './product.service';
import { InsightItem, InsightsReport } from '@core/interfaces/ISaleRecordDto.interface';

@Injectable({
  providedIn: 'root'
})
export class SalesInsightsService {
  private salesService = inject(SalesProcessingService);
  private productService = inject(ProductService);

  public insightsReport = computed<InsightsReport | null>(() => {
    const data = this.salesService.filteredData();
    if (!data.length) return null;

    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
    const pct = (a: number, b: number) =>
      b === 0 ? '0%' : `${Math.abs(((a - b) / b) * 100).toFixed(1)}%`;

    const months = this.salesService.salesByMonth();
    const profitabilityInsights: InsightItem[] = [];

    if (months.length >= 2) {
      const best = [...months].sort((a, b) => b.total - a.total)[0];
      const worst = [...months].sort((a, b) => a.total - b.total)[0];
      const last = months[months.length - 1];
      const prev = months[months.length - 2];
      const trend = last.total >= prev.total ? 'up' : 'down';

      profitabilityInsights.push({
        icon: '🏆',
        title: 'Peak Revenue Month',
        body: `The strongest month on record is **${best.month}** with ${fmt(best.total)} in revenue. Focus resources and campaigns around this period to capitalize on seasonal demand.`,
        severity: 'positive'
      });
      profitabilityInsights.push({
        icon: trend === 'up' ? '📈' : '📉',
        title: 'Month-over-Month Trend',
        body: `Revenue is trending **${trend}** by ${pct(last.total, prev.total)} comparing ${prev.month} (${fmt(prev.total)}) vs. ${last.month} (${fmt(last.total)}).`,
        severity: trend === 'up' ? 'positive' : 'warning'
      });
      profitabilityInsights.push({
        icon: '⚠️',
        title: 'Slowest Month',
        body: `**${worst.month}** recorded the lowest revenue at ${fmt(worst.total)}. Consider targeted promotions or inventory clearance events during historically slow periods.`,
        severity: 'warning'
      });
    } else if (months.length === 1) {
      profitabilityInsights.push({
        icon: '📊',
        title: 'Single Period Loaded',
        body: `Only data for **${months[0].month}** is available (${fmt(months[0].total)}). Upload additional months to unlock trend analysis.`,
        severity: 'info'
      });
    }

    const warehouses = this.salesService.salesByChannel();
    const channelInsights: InsightItem[] = [];
    const totalRev = this.salesService.totalRevenue();

    if (warehouses.length) {
      const top = warehouses[0];
      const topShare = totalRev > 0 ? ((top.total / totalRev) * 100).toFixed(1) : '0';
      channelInsights.push({
        icon: '🏪',
        title: 'Dominant Sales Channel',
        body: `**${top.channel}** is the top-performing seller/channel, contributing ${fmt(top.total)} — ${topShare}% of total revenue. Ensure supply chain continuity for this channel.`,
        severity: 'positive'
      });

      if (warehouses.length > 1) {
        const bottom = warehouses[warehouses.length - 1];
        const bottomShare = totalRev > 0 ? ((bottom.total / totalRev) * 100).toFixed(1) : '0';
        channelInsights.push({
          icon: '🔍',
          title: 'Underperforming Channel',
          body: `**${bottom.channel}** contributes only ${bottomShare}% of revenue (${fmt(bottom.total)}). Evaluate whether this channel is strategically worth maintaining or requires a dedicated push.`,
          severity: 'warning'
        });
      }

      const diversificationScore = warehouses.length >= 3 ? 'well-diversified' : 'concentrated';
      channelInsights.push({
        icon: '🗂️',
        title: 'Channel Diversification',
        body: `Revenue is spread across **${warehouses.length} channel${warehouses.length !== 1 ? 's' : ''}**, which is ${diversificationScore}. ${warehouses.length < 3 ? 'Consider expanding to additional sales channels to reduce single-channel risk.' : 'Maintain this diversification to reduce dependency on any single source.'}`,
        severity: warehouses.length >= 3 ? 'positive' : 'neutral'
      });

      // Category and macro channels analyses have been deprecated along with the respective charts.
    }

    const products = this.salesService.topProducts();
    const productInsights: InsightItem[] = [];

    if (products.length) {
      const totalUnits = products.reduce((s, p) => s + p.quantity, 0);
      const topShare = totalUnits > 0
        ? ((products[0].quantity / totalUnits) * 100).toFixed(1)
        : '0';

      const masterProducts = this.productService.products();
      const getProductInfo = (sku: string) => {
        const parent = sku.split('-')[0];
        return masterProducts.find(p => p.parent.toLowerCase() === parent.toLowerCase());
      };

      const topProductInfo = getProductInfo(products[0].title);
      const topTypeName = topProductInfo?.type || '';
      const topProductDisplay = topProductInfo 
        ? `${topTypeName} (${topProductInfo.parent})`
        : products[0].title;

      productInsights.push({
        icon: '📦',
        title: 'Best-Selling Category',
        body: `The top-performing item category is **${topTypeName || 'Unknown'}**. Focusing on **${topProductInfo?.parent || products[0].title}** specifically, which accounts for ${topShare}% of volume.`,
        severity: 'positive'
      });

      const categoryMap = new Map<string, number>();
      products.forEach(p => {
        const info = getProductInfo(p.title);
        const cat = info?.type || 'Uncategorized';
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + p.quantity);
      });

      const topCategory = Array.from(categoryMap.entries()).sort((a,b) => b[1] - a[1])[0];
      if (topCategory && categoryMap.size > 1) {
        const catShare = ((topCategory[1] / totalUnits) * 100).toFixed(1);
        productInsights.push({
          icon: '🏷️',
          title: 'Category Dominance',
          body: `**${topCategory[0]}** is your most popular category, representing **${catShare}%** of all sales. Consider expanding the style variety within this category.`,
          severity: 'info'
        });
      }

      productInsights.push({
        icon: '🎯',
        title: 'Product Concentration',
        body: `The #1 SKU (**${topProductDisplay}**) accounts for **${topShare}%** of all units sold. ${parseFloat(topShare) > 40 ? 'High concentration — consider diversifying the product mix to lower risk.' : 'Healthy spread across the product catalog.'}`,
        severity: parseFloat(topShare) > 40 ? 'warning' : 'positive'
      });

      if (products.length >= 5) {
        const longTail = products.slice(4).reduce((s, p) => s + p.quantity, 0);
        const longTailPct = totalUnits > 0 ? ((longTail / totalUnits) * 100).toFixed(1) : '0';
        productInsights.push({
          icon: '📉',
          title: 'Long-Tail Products',
          body: `Products ranked #5 and below account for **${longTailPct}%** of units. Regularly audit slow-moving SKUs to avoid excess inventory carrying costs.`,
          severity: parseFloat(longTailPct) > 30 ? 'neutral' : 'info'
        });
      }
    }

    const recommendations: InsightItem[] = [];
    const totalOrders = this.salesService.totalOrders();
    const avgOrderValue = totalOrders > 0 ? totalRev / totalOrders : 0;

    recommendations.push({
      icon: '💡',
      title: 'Revenue Optimization',
      body: `With an average order value of **${fmt(avgOrderValue)}**, upselling complementary products or offering bundle promotions could increase AOV by 10–20% without additional acquisition costs.`,
      severity: 'info'
    });

    if (months.length > 1) {
      const growthMonths = months.filter((m, i) => i > 0 && m.total > months[i - 1].total).length;
      const growthRate = ((growthMonths / (months.length - 1)) * 100).toFixed(0);
      recommendations.push({
        icon: '🚀',
        title: 'Growth Momentum',
        body: `Revenue grew month-over-month in **${growthRate}%** of recorded periods. Identify and replicate the conditions (promotions, stock levels, seasonality) from high-growth months.`,
        severity: parseFloat(growthRate) >= 50 ? 'positive' : 'warning'
      });
    }

    if (warehouses.length >= 2) {
      recommendations.push({
        icon: '⚖️',
        title: 'Channel Rebalancing',
        body: `Cross-analyze the top-performing channel strategies and apply them to underperforming channels. Small operational improvements in lower-tier channels can yield disproportionate revenue gains.`,
        severity: 'info'
      });
    }

    recommendations.push({
      icon: '📋',
      title: 'Data Completeness',
      body: `This report is based on **${data.length.toLocaleString()} records** across **${totalOrders.toLocaleString()} orders**. For higher-confidence insights, ensure all channels submit complete and timely data files.`,
      severity: 'neutral'
    });

    return {
      generatedAt: DateUtils.now(),
      totalRecords: data.length,
      sections: {
        profitability: profitabilityInsights,
        channelScope: channelInsights,
        productAffinity: productInsights,
        recommendations
      }
    };
  });
}
