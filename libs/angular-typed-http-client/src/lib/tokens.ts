import { HttpContextToken } from '@angular/common/http';

export type Ctor<T> = new (...args: unknown[]) => T;

/** Carries the target class type across request clones. */
export const RESPONSE_TYPE_CLASS = new HttpContextToken<Ctor<unknown> | null>(
  () => null,
);
