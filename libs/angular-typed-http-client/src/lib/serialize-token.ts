import { HttpContextToken } from '@angular/common/http';
import type { ClassTransformOptions } from 'class-transformer';

/**
 * When set to truthy, request bodies will be serialized with instanceToPlain.
 * - true  -> use default class-transformer options
 * - object -> use provided ClassTransformOptions
 * - false (default) -> no serialization
 */
export const SERIALIZE_REQUEST = new HttpContextToken<
  false | true | ClassTransformOptions
>(() => false);
