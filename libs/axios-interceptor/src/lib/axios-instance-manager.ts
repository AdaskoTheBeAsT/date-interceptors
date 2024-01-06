import axios, { AxiosInstance } from 'axios';

/**
 * Class for managing the axios instance
 */
export class AxiosInstanceManager {
  private static cachedInstance: AxiosInstance | null = null;

  /**
   * Creates an axios instance with a response interceptor
   * @param interceptFunc Function to be called when a response is received
   * @returns AxiosInstance
   */
  public static createInstance(
    interceptFunc: (data: unknown) => void,
  ): AxiosInstance {
    if (this.cachedInstance) {
      return this.cachedInstance;
    }

    const instance = axios.create();

    instance.interceptors.response.use(
      (response) => {
        interceptFunc(response.data);

        return response;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this.cachedInstance = instance;

    return instance;
  }

  /**
   * Creates an axios instance with multiple response interceptors
   * @param interceptFunctions Array of functions to be called when a response is received
   * @returns AxiosInstance
   */
  public static createInstanceWithMultipleInterceptors(
    interceptFunctions: ((data: unknown) => void)[],
  ): AxiosInstance {
    if (this.cachedInstance) {
      return this.cachedInstance;
    }

    const instance = axios.create();

    instance.interceptors.response.use(
      (response) => {
        for (const interceptFunc of interceptFunctions) {
          interceptFunc(response.data);
        }

        return response;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    this.cachedInstance = instance;

    return instance;
  }

  /**
   * Resets the cached instance
   */
  public static resetInstance(): void {
    this.cachedInstance = null;
  }
}
