import { InjectionToken } from '@angular/core';

export const HIERARCHICAL_DATE_ADJUST_FUNCTION = new InjectionToken<
  (obj: unknown) => void
>('HIERARCHICAL_DATE_ADJUST_FUNCTION');
