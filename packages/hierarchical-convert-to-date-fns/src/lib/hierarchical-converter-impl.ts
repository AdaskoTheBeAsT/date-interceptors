import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';
import { hierarchicalConvertToDateFns } from './hierarchical-convert-to-date-fns';

export class HierarchicalConverterImpl implements HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToDateFns(obj);
  }
}
