import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';

import { hierarchicalConvertToDate } from './hierarchical-convert-to-date';

export class HierarchicalConverterImpl implements HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToDate(obj);
  }
}
