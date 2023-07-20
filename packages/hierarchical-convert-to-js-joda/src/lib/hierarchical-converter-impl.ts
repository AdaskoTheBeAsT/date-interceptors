import { HierarchicalConverter } from '@adaskothebeast/hierarchical-convert';
import { hierarchicalConvertToJsJoda } from './hierarchical-convert-to-js-joda';

export class HierarchicalConverterImpl implements HierarchicalConverter {
  convert(obj: object): void {
    hierarchicalConvertToJsJoda(obj);
  }
}
