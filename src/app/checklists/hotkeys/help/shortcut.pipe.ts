import { Pipe, PipeTransform } from '@angular/core';
import { HotkeysShortcutPipe } from '@ngneat/hotkeys';

@Pipe({
  name: 'shortcut',
  standalone: true,
})
export class ShortcutPipe implements PipeTransform {
  transform(value: string): string {
    const fixedValue = value
      // Work around a bug in the built-in pipe for arrow keys
      .replaceAll('Arrow', '')
      // Work around a bug where altleft is not recognized, but alt is not rendered correctly on OSX.
      .replaceAll('alt.', 'altleft.');
    const builtinPipe = new HotkeysShortcutPipe();
    const transformedValue = builtinPipe.transform(fixedValue);
    // Work around another bug where the built-in Pipe uses the wrong symbol for enter.
    return transformedValue.replaceAll('&#8996;', '&#8629;');
  }
}
