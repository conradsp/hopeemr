import { useState, useCallback } from 'react';

/**
 * Hook for managing dynamic array fields in forms
 * Provides standardized add, update, remove, and reset operations
 *
 * @param initialItems - Initial array of items
 * @returns Object with items state and manipulation functions
 *
 * @example
 * ```tsx
 * const { items, addItem, updateItem, removeItem, setItems } = useArrayField<FieldType>([]);
 *
 * // Add a new field
 * addItem({ name: '', type: 'string' });
 *
 * // Update a field at index 0
 * updateItem(0, { name: 'fieldName' });
 *
 * // Remove field at index 1
 * removeItem(1);
 * ```
 */
export function useArrayField<T>(initialItems: T[] = []) {
  const [items, setItems] = useState<T[]>(initialItems);

  /**
   * Add a new item to the end of the array
   */
  const addItem = useCallback((newItem: T) => {
    setItems((current) => [...current, newItem]);
  }, []);

  /**
   * Update an item at a specific index with partial updates
   */
  const updateItem = useCallback((index: number, updates: Partial<T>) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? { ...item, ...updates } : item))
    );
  }, []);

  /**
   * Remove an item at a specific index
   */
  const removeItem = useCallback((index: number) => {
    setItems((current) => current.filter((_, i) => i !== index));
  }, []);

  /**
   * Move an item from one index to another
   */
  const moveItem = useCallback((fromIndex: number, toIndex: number) => {
    setItems((current) => {
      const newItems = [...current];
      const [removed] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, removed);
      return newItems;
    });
  }, []);

  /**
   * Replace an item at a specific index entirely
   */
  const replaceItem = useCallback((index: number, newItem: T) => {
    setItems((current) =>
      current.map((item, i) => (i === index ? newItem : item))
    );
  }, []);

  /**
   * Clear all items
   */
  const clearItems = useCallback(() => {
    setItems([]);
  }, []);

  /**
   * Reset items to initial state
   */
  const resetItems = useCallback((newItems: T[] = initialItems) => {
    setItems(newItems);
  }, [initialItems]);

  return {
    items,
    setItems,
    addItem,
    updateItem,
    removeItem,
    moveItem,
    replaceItem,
    clearItems,
    resetItems,
    /** Number of items in the array */
    count: items.length,
    /** Whether the array is empty */
    isEmpty: items.length === 0,
  };
}
