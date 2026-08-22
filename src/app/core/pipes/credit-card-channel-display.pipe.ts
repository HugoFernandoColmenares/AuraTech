import { Pipe, PipeTransform } from '@angular/core';

/** Company-standard credit card channel labels (display only). */
export const CREDIT_CARD_CHANNEL_LABELS = [
  'Retail',
  'Amazon',
  'Wholesale',
  'Walmart',
  'Social Media',
  'Fashion Go',
  'Studio',
  'Nordstrom',
] as const;

export type CreditCardChannelLabel = (typeof CREDIT_CARD_CHANNEL_LABELS)[number];

const CHANNEL_ALIASES: Record<string, CreditCardChannelLabel> = {
  RETAIL: 'Retail',
  AMAZON: 'Amazon',
  'AMAZON DS': 'Amazon',
  'AMAZON RETAIL': 'Amazon',
  WHOLESALE: 'Wholesale',
  WHOLESALES: 'Wholesale',
  'WHOLESALE/RETAIL': 'Wholesale',
  WALMART: 'Walmart',
  'SOCIAL MEDIA': 'Social Media',
  SOCIAL: 'Social Media',
  'FASHION GO': 'Fashion Go',
  FASHIONGO: 'Fashion Go',
  'FASHION-GO': 'Fashion Go',
  STUDIO: 'Studio',
  NORDSTROM: 'Nordstrom',
  'NORDSTROM STUDIO': 'Nordstrom',
};

export function mapCreditCardChannel(value: string | null | undefined): CreditCardChannelLabel | string {
  if (value == null || value.trim() === '') return 'Retail';

  const normalized = value.trim().toUpperCase().replace(/\s+/g, ' ');
  if (CHANNEL_ALIASES[normalized]) {
    return CHANNEL_ALIASES[normalized];
  }

  const exact = CREDIT_CARD_CHANNEL_LABELS.find(
    label => label.toUpperCase() === normalized
  );
  return exact ?? value.trim();
}

@Pipe({
  name: 'creditCardChannelDisplay',
  standalone: true,
})
export class CreditCardChannelDisplayPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return mapCreditCardChannel(value);
  }
}
