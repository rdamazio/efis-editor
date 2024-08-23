import { Pipe, PipeTransform } from '@angular/core';
import { HotkeysShortcutPipe } from '@ngneat/hotkeys';

@Pipe({
  name: 'shortcut',
  standalone: true,
})
export class ShortcutPipe implements PipeTransform {
  transform(value: string): string {
    // Work around a bug in the built-in pipe for arrow keys
    const noArrowValue = value.replaceAll('Arrow', '');
    const builtinPipe = new HotkeysShortcutPipe();
    const transformedValue = builtinPipe.transform(noArrowValue);
    // Work around another bug where the built-in Pipe uses the wrong symbol for enter.
    return transformedValue.replaceAll('&#8996;', '&#8629;');
  }
}
