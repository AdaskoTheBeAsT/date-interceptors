import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';
import { hierarchicalConvertToDayjs } from './hierarchical-convert-to-dayjs';

export class HierarchicalConverterImpl implements HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToDayjs(obj);
  }
}
