import { AceFormat } from './ace-format';
import { FormatError } from './error';
import { FormatId } from './format-id';
import { FORMAT_REGISTRY, parseChecklistFile } from './format-registry';

describe('FormatRegistry', () => {
  it('should refuse to register duplicate format', () => {
    expect(() => {
      FORMAT_REGISTRY.register(AceFormat, FormatId.ACE, 'Duplicate format');
    }).toThrowError(/already registered/);
  });

  it('should reject getting an unknown format', () => {
    expect(() => {
      FORMAT_REGISTRY.getFormat('foobar' as FormatId);
    }).toThrowError(/not registered/);
  });

  it('should reject parsing of an unknown extension', async () => {
    const f = new File([], 'foobar.baz');
    await expectAsync(parseChecklistFile(f)).toBeRejectedWithError(FormatError, /Unknown.*extension/);
  });
});
