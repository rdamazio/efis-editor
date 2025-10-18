import { GrtLiveData } from './grt-live-data';

describe('GrtLiveData', () => {
  beforeEach(() => {
    spyOn(Math, 'random').and.returnValue(0.1);
  });

  it('GRT string replacements', () => {
    expect(GrtLiveData.replaceLiveDataFields('Some text without variables')).toEqual('Some text without variables');
    expect(GrtLiveData.replaceLiveDataFields('RPM is %86%, EGT is %103%')).toEqual('RPM is 2455, EGT is 1210');
    expect(GrtLiveData.replaceLiveDataFields('Wind %75% at %74%')).toEqual('Wind 246 at 6');
    expect(GrtLiveData.replaceLiveDataFields('Roll %58%, pitch %59%')).toEqual('Roll -4, pitch -4');
    expect(GrtLiveData.replaceLiveDataFields('Selected %81% at %53%')).toEqual('Selected 7500 at 29.92');
    expect(GrtLiveData.replaceLiveDataFields('Invalid variable %999% and %1%')).toEqual(
      'Invalid variable %999% and %1%',
    );
    expect(GrtLiveData.replaceLiveDataFields('Bogus % in 1 string %')).toEqual('Bogus % in 1 string %');
  });

  it('replaces all possible parameters', () => {
    for (let i = 0; i <= 130; i++) {
      expect(GrtLiveData.replaceLiveDataFields(`Replace %${i}%`)).not.toContain(`%${i}%`);
    }
  });
});
