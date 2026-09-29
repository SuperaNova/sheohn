import { describe, expect, test } from 'vitest';
import {
  InfraError,
  describeResponse,
  isInfraErrorMessage,
  isInfraStatus,
} from './eval-infra';

describe('isInfraStatus', () => {
  test.each([429, 502, 503, 504])('%i is infra', (status) => {
    expect(isInfraStatus(status)).toBe(true);
  });

  test.each([200, 400, 404, 500])('%i is not infra', (status) => {
    expect(isInfraStatus(status)).toBe(false);
  });
});

describe('isInfraErrorMessage', () => {
  test('recognizes InfraError messages', () => {
    expect(isInfraErrorMessage(new InfraError('HTTP 503').message)).toBe(true);
  });

  test('recognizes Playwright request timeouts and disposed contexts', () => {
    expect(
      isInfraErrorMessage('apiRequestContext.post: Request context disposed.'),
    ).toBe(true);
    expect(
      isInfraErrorMessage('apiRequestContext.post: Timeout 30000ms exceeded.'),
    ).toBe(true);
    expect(isInfraErrorMessage('Test timeout of 30000ms exceeded.')).toBe(true);
  });

  test('leaves assertion failures and empty messages alone', () => {
    expect(isInfraErrorMessage('expected a tool-open_resume call')).toBe(false);
    expect(isInfraErrorMessage(undefined)).toBe(false);
  });
});

describe('describeResponse', () => {
  test('includes the status and a trimmed body snippet', () => {
    expect(describeResponse(503, ' high\n demand ')).toBe(
      'HTTP 503: high demand',
    );
  });

  test('truncates long bodies', () => {
    expect(describeResponse(500, 'x'.repeat(500)).length).toBeLessThan(220);
  });

  test('notes an empty body', () => {
    expect(describeResponse(200, '')).toBe('HTTP 200 with an empty body');
  });
});
