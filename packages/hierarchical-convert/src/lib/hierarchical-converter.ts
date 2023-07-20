/**
 * Interface for hierarchical converter
 */
export abstract class HierarchicalConverter {
  static instance: HierarchicalConverter;
  abstract convert(obj: object): void;
}
