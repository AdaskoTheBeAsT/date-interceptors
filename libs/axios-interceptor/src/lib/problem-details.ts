import {
  attachProblemDetails,
  throwIfProblemDetails,
} from '@adaskothebeast/hierarchical-convert-core';
import { AxiosError, isAxiosError } from 'axios';
import type { AxiosResponse } from 'axios';

const view = (response: AxiosResponse) => ({
  status: response.status,
  headers: response.headers,
  body: response.data,
});

export function checkProblemDetailsResponse(response: AxiosResponse): void {
  throwIfProblemDetails(
    view(response),
    () =>
      new AxiosError(
        'Problem Details response',
        'ERR_PROBLEM_DETAILS',
        response.config,
        response.request,
        response,
      ),
  );
}

export function rejectProblemDetails(error: unknown): Promise<never> {
  if (isAxiosError(error) && error.response)
    attachProblemDetails(error, view(error.response));
  return Promise.reject(error);
}
