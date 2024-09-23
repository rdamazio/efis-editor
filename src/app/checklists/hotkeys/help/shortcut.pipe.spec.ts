import { ShortcutPipe } from './shortcut.pipe';

describe('ShortcutPipe', () => {
  it('', () => {
    const pipe = new ShortcutPipe();
    expect(pipe).toBeTruthy();

    expect(pipe.transform('shift.up')).toEqual('&#8679; + &#8593;');
    expect(pipe.transform('shift.ArrowDown')).toEqual('&#8679; + &#8595;');
    expect(pipe.transform('alt.up')).toEqual('&#8997; + &#8593;');
    expect(pipe.transform('up>ArrowUp>down>ArrowDown>left>right>ArrowLeft>ArrowRight>B>A')).toEqual(
      '&#8593; then &#8593; then &#8595; then &#8595; then &#8592; then &#8594; then &#8592; then &#8594; then b then a',
    );
  });
});
