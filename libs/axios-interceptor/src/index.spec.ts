import { ProblemDetailsError, isProblemDetailsError } from './index';

describe('public Problem Details exports', () => {
  it('recognizes errors constructed from the public entry point', () => {
    const error = new ProblemDetailsError(422, { title: 'Invalid request' });
    expect(isProblemDetailsError(error)).toBe(true);
    expect(error.httpStatus).toBe(422);
  });
});
