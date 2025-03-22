import { MultipartEncoder } from './multipart';

const BOUNDARY = '==FOOBAR==';

describe('MultipartEncoder', () => {
  it('generates random boundaries if needed', () => {
    const encoder = new MultipartEncoder();
    expect(encoder.contentType()).toMatch(/^multipart\/mixed; boundary=[a-z0-9]{40}$/);
  });

  it('encodes a part', () => {
    const encoder = new MultipartEncoder(BOUNDARY);
    encoder.addPart('My contents');
    expect(encoder.finish()).toEqual('\r\n--==FOOBAR==\r\n\r\nMy contents\r\n--==FOOBAR==--');
  });

  it('encodes multiple parts', () => {
    const encoder = new MultipartEncoder(BOUNDARY);
    encoder.addPart('My first contents');
    encoder.addPart('My second contents');
    expect(encoder.finish()).toEqual(
      '\r\n--==FOOBAR==\r\n\r\nMy first contents\r\n--==FOOBAR==\r\n\r\nMy second contents\r\n--==FOOBAR==--',
    );
  });

  it('sets content type header', () => {
    const encoder = new MultipartEncoder(BOUNDARY);
    encoder.addPart('My JPG', { mimeType: 'image/jpeg' });
    encoder.addPart('My text', { mimeType: 'text/plain' });
    expect(encoder.finish()).toEqual(
      '\r\n--==FOOBAR==\r\nContent-Type: image/jpeg\r\n\r\nMy JPG\r\n--==FOOBAR==\r\nContent-Type: text/plain\r\n\r\nMy text\r\n--==FOOBAR==--',
    );
  });

  it('base64-encodes contents', () => {
    const encoder = new MultipartEncoder(BOUNDARY);
    encoder.addPart('My JPG', { base64encode: true, mimeType: 'image/jpeg' });
    encoder.addPart('My text', { mimeType: 'text/plain' });
    expect(encoder.finish()).toEqual(
      '\r\n--==FOOBAR==\r\nContent-Type: image/jpeg\r\nContent-Transfer-Encoding: base64\r\n\r\nTXkgSlBH\r\n--==FOOBAR==\r\nContent-Type: text/plain\r\n\r\nMy text\r\n--==FOOBAR==--',
    );
  });
});
