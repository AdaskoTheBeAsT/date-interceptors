import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';

import { hierarchicalConvertToLuxon } from './hierarchical-convert-to-luxon';

export class HierarchicalConverterImpl extends HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToLuxon(obj);
  }
}
