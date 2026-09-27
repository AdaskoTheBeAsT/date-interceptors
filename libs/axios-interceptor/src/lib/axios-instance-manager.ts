import { isJsonContainer } from '@adaskothebeast/hierarchical-convert-core';
import axios from 'axios';
import type { AxiosInstance, AxiosResponse, CreateAxiosDefaults } from 'axios';

import {
  checkProblemDetailsResponse,
  rejectProblemDetails,
} from './problem-details';

/** Mutates parsed response data in place, e.g. `hierarchicalConvertToDate`. */
export type HierarchicalConverter = (data: unknown) => void;

/**
 * Only JSON that axios parsed into plain objects or arrays is converted.
 * Binary, stream, blob and text responses (including JSON-labelled ones) are
 * left untouched, as are class instances produced by custom transforms.
 */
function shouldConvertAxiosResponse(response: AxiosResponse): boolean {
  const responseType = response.config?.responseType;
  return (
    (responseType === undefined || responseType === 'json') &&
    isJsonContainer(response.data)
  );
}

/**
 * Adds Problem Details detection and hierarchical conversion to an existing
 * axios instance. Converters run in array order.
 *
 * @returns A function that removes the interceptor again.
 *
 * @example
 * ```typescript
 * const api = axios.create({ baseURL: '/api' });
 * const eject = attachHierarchicalConverter(api, hierarchicalConvertToDate);
 * // later, e.g. in tests
 * eject();
 * ```
 */
export function attachHierarchicalConverter(
  instance: AxiosInstance,
  converters: HierarchicalConverter | readonly HierarchicalConverter[],
): () => void {
  const list =
    typeof converters === 'function' ? [converters] : [...converters];
  const id = instance.interceptors.response.use((response) => {
    checkProblemDetailsResponse(response);
    if (shouldConvertAxiosResponse(response)) {
      for (const convert of list) {
        convert(response.data);
      }
    }
    return response;
  }, rejectProblemDetails);
  return () => instance.interceptors.response.eject(id);
}

/**
 * Creates axios instances with date conversion interceptors.
 *
 * Each call creates a NEW axios instance. Store the returned instance and
 * reuse it. To add conversion to an instance you already own, use
 * {@link attachHierarchicalConverter}.
 */
export class AxiosInstanceManager {
  /**
   * Creates a new axios instance with a response interceptor.
   *
   * @param interceptFunc Called with parsed JSON response data; it should
   *                      mutate the data in place to convert date strings.
   * @param config Optional defaults passed to `axios.create`.
   *
   * @example
   * ```typescript
   * import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
   *
   * const axiosInstance = AxiosInstanceManager.createInstance(
   *   hierarchicalConvertToDate,
   *   { baseURL: '/api' },
   * );
   * const response = await axiosInstance.get('/users');
   * ```
   */
  public static createInstance(
    interceptFunc: HierarchicalConverter,
    config?: CreateAxiosDefaults,
  ): AxiosInstance {
    return AxiosInstanceManager.createInstanceWithMultipleInterceptors(
      [interceptFunc],
      config,
    );
  }

  /**
   * Creates a new axios instance whose converters run in array order.
   *
   * @example
   * ```typescript
   * const axiosInstance = AxiosInstanceManager.createInstanceWithMultipleInterceptors([
   *   hierarchicalConvertToDate,
   *   (data) => console.log('Response data:', data),
   * ]);
   * ```
   */
  public static createInstanceWithMultipleInterceptors(
    interceptFunctions: readonly HierarchicalConverter[],
    config?: CreateAxiosDefaults,
  ): AxiosInstance {
    const instance = axios.create(config);
    attachHierarchicalConverter(instance, interceptFunctions);
    return instance;
  }
}
