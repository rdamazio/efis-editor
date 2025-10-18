import { Pipe, PipeTransform } from '@angular/core';
import { GrtLiveData } from '../../../model/formats/grt-live-data';

// Pipe that replaces dynamic data tokens with random dynamic data
// when not editing an entry.
@Pipe({
  name: 'dynamicData',
  standalone: true,
  pure: false, // eslint-disable-line @angular-eslint/no-pipe-impure
})
export class DynamicDataPipe implements PipeTransform {
  transform(value: string): string {
    value = GrtLiveData.replaceLiveDataFields(value);
    return value;
  }
}
