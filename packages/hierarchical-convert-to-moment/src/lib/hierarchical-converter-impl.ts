import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';

import { hierarchicalConvertToMoment } from './hierarchical-convert-to-moment';

export class HierarchicalConverterImpl implements HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToMoment(obj);
  }
}
