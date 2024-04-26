
export class FormatError extends Error {
    constructor(message: string, cause?: Error) {
        super(message);
        this.name = 'FormatError';
    }
}