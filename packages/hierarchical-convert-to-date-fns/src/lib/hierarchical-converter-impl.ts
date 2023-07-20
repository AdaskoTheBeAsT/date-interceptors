import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';

import { hierarchicalConvertToDateFns } from './hierarchical-convert-to-date-fns';

export class HierarchicalConverterImpl extends HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToDateFns(obj);
  }
}
