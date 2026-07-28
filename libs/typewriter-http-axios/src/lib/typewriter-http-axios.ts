import {
  serializeJson,
  transformJson,
} from '@adaskothebeast/typewriter-runtime';
import type {
  JsonSerializerOptions,
  JsonTransformerRegistry,
  JsonTransformerOptions,
  SchemaDescriptor,
} from '@adaskothebeast/typewriter-runtime';
import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from 'axios';

type ResponseSchema = SchemaDescriptor<unknown>;

declare module 'axios' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface AxiosRequestConfig<D = any> {
    responseSchema?: ResponseSchema;
    responseSchemaRegistry?: JsonTransformerRegistry;
    responseTransformOptions?: JsonTransformerOptions;
    requestSchema?: ResponseSchema;
    requestSchemaRegistry?: JsonTransformerRegistry;
    requestSerializeOptions?: JsonSerializerOptions;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
  interface InternalAxiosRequestConfig<D = any> {
    responseSchema?: ResponseSchema;
    responseSchemaRegistry?: JsonTransformerRegistry;
    responseTransformOptions?: JsonTransformerOptions;
    requestSchema?: ResponseSchema;
    requestSchemaRegistry?: JsonTransformerRegistry;
    requestSerializeOptions?: JsonSerializerOptions;
  }
}

export function installTypewriterAxiosRequestInterceptor(
  instance: AxiosInstance,
): number {
  return instance.interceptors.request.use((config) => {
    if (config.requestSchema !== undefined && config.data !== undefined) {
      config.data = serializeJson(
        config.data,
        config.requestSchema,
        config.requestSchemaRegistry,
        config.requestSerializeOptions,
      );
    }

    return config;
  });
}

export function ejectTypewriterAxiosRequestInterceptor(
  instance: AxiosInstance,
  id: number,
): void {
  instance.interceptors.request.eject(id);
}

export function installTypewriterAxiosInterceptor(
  instance: AxiosInstance,
): number {
  return instance.interceptors.response.use((response) => {
    const {
      responseSchema,
      responseSchemaRegistry,
      responseTransformOptions,
    } = response.config;

    if (responseSchema !== undefined) {
      response.data = transformJson(
        response.data,
        responseSchema,
        responseSchemaRegistry,
        responseTransformOptions,
      );
    }

    return response;
  });
}

export function ejectTypewriterAxiosInterceptor(
  instance: AxiosInstance,
  id: number,
): void {
  instance.interceptors.response.eject(id);
}

export function requestWithSchema<T, D = unknown>(
  instance: AxiosInstance,
  schema: SchemaDescriptor<T>,
  config: AxiosRequestConfig<D>,
): Promise<AxiosResponse<T, D>> {
  return instance.request<T, AxiosResponse<T, D>, D>({
    ...config,
    responseSchema: schema,
  });
}
