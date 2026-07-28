import {
  HttpFeature,
  HttpFeatureKind,
  withInterceptors,
} from '@angular/common/http';

import { typewriterHttpInterceptor } from './typewriter-http-interceptor';

export function withTypewriterHttpInterceptor(): HttpFeature<
  HttpFeatureKind.Interceptors
> {
  return withInterceptors([typewriterHttpInterceptor]);
}
