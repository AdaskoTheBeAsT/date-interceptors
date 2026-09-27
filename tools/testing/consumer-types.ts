import { useAdjustUseQueryHookResultWithHierarchicalDateConverter as useConverted } from '@adaskothebeast/react-redux-toolkit-hierarchical-date-hook';
import type { ProblemDetailsQueryError } from '@adaskothebeast/react-redux-toolkit-hierarchical-date-hook';
import { fetchJson } from '@adaskothebeast/typewriter-http-fetch';
import {
  TypewriterFetchError,
  isProblemDetailsError,
} from '@adaskothebeast/typewriter-http-fetch';
import { schema } from '@adaskothebeast/typewriter-schema';

export function useConsumer() {
  const query = {
    data: { date: '2026-01-01T00:00:00Z' },
    error: { status: 500, data: 'failure' },
    refetch: () => Promise.resolve(1),
  };
  const result = useConverted(query, () => ({
    date: new Date(query.data.date),
  }));
  const date: Date = result.data.date;
  const status: number = result.error.status;
  const refetch: Promise<number> = result.refetch();
  return { date, status, refetch };
}

async function checkEmptyResponse() {
  const value = await fetchJson('/value', schema.string());
  const maybeString: string | undefined = value;
  // @ts-expect-error Empty successful responses are part of the public contract.
  const requiredString: string = value;
  return { maybeString, requiredString };
}
void checkEmptyResponse;

export function inspectProblem(error: unknown) {
  if (error instanceof TypewriterFetchError && isProblemDetailsError(error)) {
    const status: number = error.httpStatus;
    const title: string | undefined = error.problem?.title;
    const validationErrors: unknown = error.problem?.['errors'];
    const response: Response | undefined = error.response;
    return { status, title, validationErrors, response };
  }
  return undefined;
}
export function inspectQueryProblem(error: ProblemDetailsQueryError): number {
  return error.httpStatus;
}
