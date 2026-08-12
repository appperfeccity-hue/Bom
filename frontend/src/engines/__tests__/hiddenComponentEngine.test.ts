import { describe, it, expect } from 'vitest';
import { calculateHiddenComponent } from '../hiddenComponentEngine';
import { EngineError } from '../types';

describe('hiddenComponentEngine', () => {
  describe('ALWAYS trigger type', () => {
    it('should always include component', () => {
      const result = calculateHiddenComponent({
        triggerType: 'ALWAYS',
        quantityRule: 'FIXED',
        fixedValue: 4,
      });
      expect(result.included).toBe(true);
      expect(result.quantity).toBe(4);
    });
  });

  describe('CONDITION trigger type', () => {
    it('should include when EQ condition matches', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'material', operator: 'EQ', value: 'wood' },
        quantityRule: 'FIXED',
        fixedValue: 2,
        fieldValues: { material: 'wood' },
      });
      expect(result.included).toBe(true);
      expect(result.quantity).toBe(2);
    });

    it('should exclude when EQ condition does not match', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'material', operator: 'EQ', value: 'wood' },
        quantityRule: 'FIXED',
        fixedValue: 2,
        fieldValues: { material: 'metal' },
      });
      expect(result.included).toBe(false);
      expect(result.quantity).toBe(0);
    });

    it('should include when NEQ condition matches', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'finish', operator: 'NEQ', value: 'matte' },
        quantityRule: 'FIXED',
        fixedValue: 1,
        fieldValues: { finish: 'gloss' },
      });
      expect(result.included).toBe(true);
      expect(result.quantity).toBe(1);
    });

    it('should include when GT condition matches', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'width', operator: 'GT', value: 1000 },
        quantityRule: 'FIXED',
        fixedValue: 3,
        fieldValues: { width: 1500 },
      });
      expect(result.included).toBe(true);
      expect(result.quantity).toBe(3);
    });

    it('should exclude when GT condition does not match', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'width', operator: 'GT', value: 1000 },
        quantityRule: 'FIXED',
        fixedValue: 3,
        fieldValues: { width: 1000 },
      });
      expect(result.included).toBe(false);
      expect(result.quantity).toBe(0);
    });

    it('should include when LT condition matches', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'height', operator: 'LT', value: 500 },
        quantityRule: 'FIXED',
        fixedValue: 1,
        fieldValues: { height: 400 },
      });
      expect(result.included).toBe(true);
    });

    it('should include when GTE condition matches (equal)', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'count', operator: 'GTE', value: 5 },
        quantityRule: 'FIXED',
        fixedValue: 2,
        fieldValues: { count: 5 },
      });
      expect(result.included).toBe(true);
    });

    it('should include when LTE condition matches (equal)', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'count', operator: 'LTE', value: 5 },
        quantityRule: 'FIXED',
        fixedValue: 2,
        fieldValues: { count: 5 },
      });
      expect(result.included).toBe(true);
    });

    it('should exclude when field is missing from fieldValues', () => {
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'missing_field', operator: 'EQ', value: 'x' },
        quantityRule: 'FIXED',
        fixedValue: 2,
        fieldValues: {},
      });
      expect(result.included).toBe(false);
      expect(result.quantity).toBe(0);
    });

    it('should throw EngineError when condition is missing', () => {
      expect(() =>
        calculateHiddenComponent({
          triggerType: 'CONDITION',
          quantityRule: 'FIXED',
          fixedValue: 1,
        }),
      ).toThrow(EngineError);
    });

    it('should correctly compare string field value to numeric target with GT', () => {
      // "9" > 50 would be true with lexicographic comparison, false with numeric
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'width', operator: 'GT', value: 50 },
        quantityRule: 'FIXED',
        fixedValue: 1,
        fieldValues: { width: '9' },
      });
      expect(result.included).toBe(false);
    });

    it('should correctly compare numeric string field to numeric target with LT', () => {
      // "100" < 50 would be true with lexicographic comparison, false with numeric
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'height', operator: 'LT', value: 50 },
        quantityRule: 'FIXED',
        fixedValue: 1,
        fieldValues: { height: '100' },
      });
      expect(result.included).toBe(false);
    });

    it('should correctly compare two string numbers with GTE', () => {
      // "9" >= "50" would be true lexicographically, false numerically
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'count', operator: 'GTE', value: '50' },
        quantityRule: 'FIXED',
        fixedValue: 1,
        fieldValues: { count: '9' },
      });
      expect(result.included).toBe(false);
    });

    it('should correctly compare two string numbers with LTE', () => {
      // "100" <= "50" would be true lexicographically ("1" < "5"), false numerically
      const result = calculateHiddenComponent({
        triggerType: 'CONDITION',
        condition: { field: 'count', operator: 'LTE', value: '50' },
        quantityRule: 'FIXED',
        fixedValue: 1,
        fieldValues: { count: '100' },
      });
      expect(result.included).toBe(false);
    });
  });

  describe('DEPENDENCY trigger type', () => {
    it('should include when parent is present', () => {
      const result = calculateHiddenComponent({
        triggerType: 'DEPENDENCY',
        quantityRule: 'FIXED',
        fixedValue: 2,
        parentPresent: true,
      });
      expect(result.included).toBe(true);
      expect(result.quantity).toBe(2);
    });

    it('should exclude when parent is not present', () => {
      const result = calculateHiddenComponent({
        triggerType: 'DEPENDENCY',
        quantityRule: 'FIXED',
        fixedValue: 2,
        parentPresent: false,
      });
      expect(result.included).toBe(false);
      expect(result.quantity).toBe(0);
    });

    it('should exclude when parentPresent is undefined', () => {
      const result = calculateHiddenComponent({
        triggerType: 'DEPENDENCY',
        quantityRule: 'FIXED',
        fixedValue: 2,
      });
      expect(result.included).toBe(false);
      expect(result.quantity).toBe(0);
    });
  });

  describe('quantity rules', () => {
    describe('FIXED', () => {
      it('should return the fixed value', () => {
        const result = calculateHiddenComponent({
          triggerType: 'ALWAYS',
          quantityRule: 'FIXED',
          fixedValue: 8,
        });
        expect(result.quantity).toBe(8);
      });

      it('should throw when fixedValue is missing', () => {
        expect(() =>
          calculateHiddenComponent({
            triggerType: 'ALWAYS',
            quantityRule: 'FIXED',
          }),
        ).toThrow(EngineError);
      });
    });

    describe('PER_ZONE', () => {
      it('should return fixedValue * zoneCount', () => {
        const result = calculateHiddenComponent({
          triggerType: 'ALWAYS',
          quantityRule: 'PER_ZONE',
          fixedValue: 2,
          zoneCount: 5,
        });
        expect(result.quantity).toBe(10);
      });

      it('should throw when fixedValue is missing', () => {
        expect(() =>
          calculateHiddenComponent({
            triggerType: 'ALWAYS',
            quantityRule: 'PER_ZONE',
            zoneCount: 3,
          }),
        ).toThrow(EngineError);
      });

      it('should throw when zoneCount is missing', () => {
        expect(() =>
          calculateHiddenComponent({
            triggerType: 'ALWAYS',
            quantityRule: 'PER_ZONE',
            fixedValue: 2,
          }),
        ).toThrow(EngineError);
      });
    });

    describe('PER_PANEL', () => {
      it('should return fixedValue * panelCount', () => {
        const result = calculateHiddenComponent({
          triggerType: 'ALWAYS',
          quantityRule: 'PER_PANEL',
          fixedValue: 4,
          panelCount: 6,
        });
        expect(result.quantity).toBe(24);
      });

      it('should throw when fixedValue is missing', () => {
        expect(() =>
          calculateHiddenComponent({
            triggerType: 'ALWAYS',
            quantityRule: 'PER_PANEL',
            panelCount: 3,
          }),
        ).toThrow(EngineError);
      });

      it('should throw when panelCount is missing', () => {
        expect(() =>
          calculateHiddenComponent({
            triggerType: 'ALWAYS',
            quantityRule: 'PER_PANEL',
            fixedValue: 2,
          }),
        ).toThrow(EngineError);
      });
    });

    describe('DERIVED_FROM_PARENT', () => {
      it('should return parentQuantity', () => {
        const result = calculateHiddenComponent({
          triggerType: 'ALWAYS',
          quantityRule: 'DERIVED_FROM_PARENT',
          parentQuantity: 12,
        });
        expect(result.quantity).toBe(12);
      });

      it('should throw when parentQuantity is missing', () => {
        expect(() =>
          calculateHiddenComponent({
            triggerType: 'ALWAYS',
            quantityRule: 'DERIVED_FROM_PARENT',
          }),
        ).toThrow(EngineError);
      });
    });
  });
});
