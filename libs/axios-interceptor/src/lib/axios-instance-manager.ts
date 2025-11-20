import axios, { AxiosInstance } from 'axios';

/**
 * Class for managing axios instances with date conversion interceptors.
 * 
 * Note: Each call to createInstance() or createInstanceWithMultipleInterceptors()
 * creates a NEW axios instance. If you need to reuse the same instance across your
 * application, store the returned instance and pass it around rather than calling
 * createInstance() multiple times.
 */
export class AxiosInstanceManager {
  /**
   * Creates a new axios instance with a response interceptor.
   * 
   * @param interceptFunc Function to be called when a response is received.
   *                      This function will be called with response.data and
   *                      should mutate the data in-place to convert date strings.
   * @returns A new AxiosInstance configured with the provided interceptor
   * 
   * @example
   * ```typescript
   * import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
   * 
   * const axiosInstance = AxiosInstanceManager.createInstance(hierarchicalConvertToDate);
   * 
   * // Reuse this instance throughout your app
   * const response = await axiosInstance.get('/api/users');
   * ```
   */
  public static createInstance(
    interceptFunc: (data: unknown) => void,
  ): AxiosInstance {
    const instance = axios.create();

    instance.interceptors.response.use(
      (response) => {
        if (response.data != null) {
          interceptFunc(response.data);
        }
        return response;
      },
      (error: Error) => {
        return Promise.reject(error);
      },
    );

    return instance;
  }

  /**
   * Creates a new axios instance with multiple response interceptors.
   * Interceptors are applied in the order they appear in the array.
   * 
   * @param interceptFunctions Array of functions to be called when a response is received.
   *                          Each function will be called with response.data in sequence.
   * @returns A new AxiosInstance configured with the provided interceptors
   * 
   * @example
   * ```typescript
   * import { hierarchicalConvertToDate } from '@adaskothebeast/hierarchical-convert-to-date';
   * 
   * const axiosInstance = AxiosInstanceManager.createInstanceWithMultipleInterceptors([
   *   hierarchicalConvertToDate,
   *   (data) => console.log('Response data:', data),
   * ]);
   * ```
   */
  public static createInstanceWithMultipleInterceptors(
    interceptFunctions: ((data: unknown) => void)[],
  ): AxiosInstance {
    const instance = axios.create();

    instance.interceptors.response.use(
      (response) => {
        if (response.data != null) {
          for (const interceptFunc of interceptFunctions) {
            interceptFunc(response.data);
          }
        }
        return response;
      },
      (error: Error) => {
        return Promise.reject(error);
      },
    );

    return instance;
  }
}
