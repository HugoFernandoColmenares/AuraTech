import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'channelDisplay',
  standalone: true,
})
export class ChannelDisplayPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ?? '';
  }
}
