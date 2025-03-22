import { DynamicDataPipe } from './dynamic-data.pipe';

describe('DynamicDataPipe', () => {
  let pipe: DynamicDataPipe;

  beforeEach(() => {
    pipe = new DynamicDataPipe();

    spyOn(Math, 'random').and.returnValue(0.1);
  });

  it('various string replacements', () => {
    expect(pipe).toBeTruthy();

    expect(pipe.transform('Some text without variables')).toEqual('Some text without variables');
    expect(pipe.transform('RPM is %86%, EGT is %103%')).toEqual('RPM is 2455, EGT is 1210');
    expect(pipe.transform('Wind %75% at %74%')).toEqual('Wind 246 at 6');
    expect(pipe.transform('Roll %58%, pitch %59%')).toEqual('Roll -4, pitch -4');
    expect(pipe.transform('Selected %81% at %53%')).toEqual('Selected 7500 at 29.92');
    expect(pipe.transform('Invalid variable %999% and %1%')).toEqual('Invalid variable %999% and %1%');
    expect(pipe.transform('Bogus % in 1 string %')).toEqual('Bogus % in 1 string %');
  });

  it('replaces all possible parameters', () => {
    for (let i = 0; i <= 130; i++) {
      expect(pipe.transform(`Replace %${i}%`)).not.toContain(`%${i}%`);
    }
  });
});
