import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';

import { hierarchicalConvertToDayjs } from './hierarchical-convert-to-dayjs';

export class HierarchicalConverterImpl extends HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToDayjs(obj);
  }
}
