import { ShortcutPipe } from './shortcut.pipe';

describe('ShortcutPipe', () => {
  it('should perform expected transformations', () => {
    const pipe = new ShortcutPipe();
    expect(pipe).toBeTruthy();

    expect(pipe.transform('shift.up')).toEqual('&#8679; + &#8593;');
    expect(pipe.transform('shift.ArrowDown')).toEqual('&#8679; + &#8595;');
    expect(pipe.transform('up>ArrowUp>down>ArrowDown>left>right>ArrowLeft>ArrowRight>B>A')).toEqual(
      '&#8593; then &#8593; then &#8595; then &#8595; then &#8592; then &#8594; then &#8592; then &#8594; then b then a',
    );
  });

  it('should perform Mac-specific transformations', () => {
    spyOnProperty(window.navigator, 'userAgent').and.returnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/129.0.0.0',
    );
    const pipe = new ShortcutPipe();
    expect(pipe).toBeTruthy();

    expect(pipe.transform('alt.up')).toEqual('&#8997; + &#8593;');
  });

  it('should perform non-Mac transformations', () => {
    spyOnProperty(window.navigator, 'userAgent').and.returnValue(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0.0.0',
    );
    const pipe = new ShortcutPipe();
    expect(pipe).toBeTruthy();

    expect(pipe.transform('alt.up')).toEqual('Alt + &#8593;');
  });
});
