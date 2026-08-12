import { describe, it, expect } from 'vitest';
import { calculateFurniture } from '../furnitureEngine';
import { EngineError } from '../types';

describe('furnitureEngine', () => {
  describe('valid quantity within range', () => {
    it('should return quantity when within [min, max]', () => {
      const result = calculateFurniture({
        quantity: 3,
        min: 1,
        max: 5,
        skuId: 'sku-001',
      });
      expect(result.quantity).toBe(3);
      expect(result.omitted).toBe(false);
    });

    it('should accept quantity at min boundary', () => {
      const result = calculateFurniture({
        quantity: 1,
        min: 1,
        max: 5,
        skuId: 'sku-001',
      });
      expect(result.quantity).toBe(1);
      expect(result.omitted).toBe(false);
    });

    it('should accept quantity at max boundary', () => {
      const result = calculateFurniture({
        quantity: 5,
        min: 1,
        max: 5,
        skuId: 'sku-001',
      });
      expect(result.quantity).toBe(5);
      expect(result.omitted).toBe(false);
    });
  });

  describe('quantity = 0 (omission)', () => {
    it('should return omitted=true when quantity is 0', () => {
      const result = calculateFurniture({
        quantity: 0,
        min: 1,
        max: 5,
        skuId: 'sku-001',
      });
      expect(result.quantity).toBe(0);
      expect(result.omitted).toBe(true);
    });
  });

  describe('quantity below min (error)', () => {
    it('should throw EngineError when quantity is below min', () => {
      expect(() =>
        calculateFurniture({
          quantity: 2,
          min: 3,
          max: 10,
          skuId: 'sku-001',
        }),
      ).toThrow(EngineError);
    });

    it('should include SKU ID in error message', () => {
      expect(() =>
        calculateFurniture({
          quantity: 1,
          min: 5,
          max: 10,
          skuId: 'sku-abc',
        }),
      ).toThrow(/sku-abc/);
    });
  });

  describe('quantity above max (error)', () => {
    it('should throw EngineError when quantity exceeds max', () => {
      expect(() =>
        calculateFurniture({
          quantity: 11,
          min: 1,
          max: 10,
          skuId: 'sku-001',
        }),
      ).toThrow(EngineError);
    });

    it('should include SKU ID in error message for max violation', () => {
      expect(() =>
        calculateFurniture({
          quantity: 100,
          min: 1,
          max: 50,
          skuId: 'sku-xyz',
        }),
      ).toThrow(/sku-xyz/);
    });
  });
});
