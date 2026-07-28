import {
  HttpFeature,
  HttpFeatureKind,
  withInterceptors,
} from '@angular/common/http';

import { hierarchicalDateHttpInterceptorFn } from './hierarchical-date-http-interceptor';

export function withHierarchicalDateHttpInterceptor(): HttpFeature<
  HttpFeatureKind.Interceptors
> {
  return withInterceptors([hierarchicalDateHttpInterceptorFn]);
}
