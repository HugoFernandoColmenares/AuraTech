import { Pipe, PipeTransform } from '@angular/core';

/** Display-only labels for channel/account names in analytics tables. */
const CHANNEL_DISPLAY_LABELS: Record<string, string> = {
  WHOLESALES: 'Wholesale',
};

@Pipe({
  name: 'channelDisplay',
  standalone: true,
})
export class ChannelDisplayPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (value == null || value === '') return '';
    const normalized = value.trim().toUpperCase();
    return CHANNEL_DISPLAY_LABELS[normalized] ?? value;
  }
}
