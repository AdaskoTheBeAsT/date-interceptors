import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';

import { hierarchicalConvertToLuxon } from './hierarchical-convert-to-luxon';

export class HierarchicalConverterImpl implements HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToLuxon(obj);
  }
}
