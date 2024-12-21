import { DynamicDataPipe } from './dynamic-data.pipe';

describe('DynamicDataPipe', () => {
  it('various string replacements', () => {
    const pipe = new DynamicDataPipe();
    expect(pipe).toBeTruthy();

    spyOn(Math, 'random').and.returnValue(0.1);
    expect(pipe.transform('Some text without variables')).toEqual('Some text without variables');
    expect(pipe.transform('RPM is %86%, EGT is %103%')).toEqual('RPM is 2455, EGT is 1210');
    expect(pipe.transform('Wind %75% at %74%')).toEqual('Wind 246 at 6');
    expect(pipe.transform('Roll %58%, pitch %59%')).toEqual('Roll -4, pitch -4');
    expect(pipe.transform('Selected %81% at %53%')).toEqual('Selected 7500 at 29.92');
    expect(pipe.transform('Invalid variable %999% and %1%')).toEqual('Invalid variable %999% and %1%');
    expect(pipe.transform('Bogus % in 1 string %')).toEqual('Bogus % in 1 string %');
  });
});
