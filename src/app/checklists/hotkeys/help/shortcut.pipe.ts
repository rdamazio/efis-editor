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
    return builtinPipe.transform(noArrowValue);
  }
}
