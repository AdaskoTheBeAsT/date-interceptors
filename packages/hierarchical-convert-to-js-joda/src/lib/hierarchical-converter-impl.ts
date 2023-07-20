import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';

import { hierarchicalConvertToJsJoda } from './hierarchical-convert-to-js-joda';

export class HierarchicalConverterImpl extends HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToJsJoda(obj);
  }
}
