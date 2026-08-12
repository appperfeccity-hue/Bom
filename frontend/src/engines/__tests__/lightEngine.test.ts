import { describe, it, expect } from 'vitest';
import { calculateLights } from '../lightEngine';

describe('lightEngine', () => {
  describe('DISCRETE mode', () => {
    it('should calculate quantity as ceiling of totalLength / unitLength', () => {
      const result = calculateLights({
        edges: [{ length: 2000 }],
        mountingType: 'DIRECT',
        mode: 'DISCRETE',
        unitLength: 600,
      });
      // totalLength = 2000 + 0 = 2000
      // quantity = CEILING(2000 / 600) = CEILING(3.33) = 4
      expect(result.totalLength).toBe(2000);
      expect(result.quantity).toBe(4);
    });

    it('should handle exact division in DISCRETE mode', () => {
      const result = calculateLights({
        edges: [{ length: 1200 }],
        mountingType: 'DIRECT',
        mode: 'DISCRETE',
        unitLength: 600,
      });
      // totalLength = 1200, quantity = CEILING(1200/600) = 2
      expect(result.quantity).toBe(2);
    });
  });

  describe('LINEAR mode', () => {
    it('should return totalLength as quantity in LINEAR mode', () => {
      const result = calculateLights({
        edges: [{ length: 3000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 600,
      });
      expect(result.totalLength).toBe(3000);
      expect(result.quantity).toBe(3000);
    });
  });

  describe('mounting offsets', () => {
    it('should apply DIRECT offset (0mm) per edge', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }, { length: 2000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 1000,
      });
      // totalLength = (1000 + 0) + (2000 + 0) = 3000
      expect(result.totalLength).toBe(3000);
    });

    it('should apply PROFILE offset (5mm) per edge', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }, { length: 2000 }],
        mountingType: 'PROFILE',
        mode: 'LINEAR',
        unitLength: 1000,
      });
      // totalLength = (1000 + 5) + (2000 + 5) = 3010
      expect(result.totalLength).toBe(3010);
    });

    it('should apply COVE offset (10mm) per edge', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }, { length: 2000 }],
        mountingType: 'COVE',
        mode: 'LINEAR',
        unitLength: 1000,
      });
      // totalLength = (1000 + 10) + (2000 + 10) = 3020
      expect(result.totalLength).toBe(3020);
    });
  });

  describe('driver count', () => {
    it('should calculate driver count = ceiling(totalLength / 5000)', () => {
      const result = calculateLights({
        edges: [{ length: 7000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 1000,
      });
      // totalLength = 7000, driverCount = CEILING(7000 / 5000) = 2
      expect(result.driverCount).toBe(2);
    });

    it('should return 1 driver for length <= 5000', () => {
      const result = calculateLights({
        edges: [{ length: 5000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 1000,
      });
      expect(result.driverCount).toBe(1);
    });

    it('should return 3 drivers for length in (10000, 15000]', () => {
      const result = calculateLights({
        edges: [{ length: 12000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 1000,
      });
      // driverCount = CEILING(12000 / 5000) = 3
      expect(result.driverCount).toBe(3);
    });
  });

  describe('wire length', () => {
    it('should calculate wire length = totalLength + 2000', () => {
      const result = calculateLights({
        edges: [{ length: 3000 }],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 1000,
      });
      expect(result.wireLength).toBe(5000);
    });
  });

  describe('multi-edge calculations', () => {
    it('should sum all edge lengths with offsets', () => {
      const result = calculateLights({
        edges: [{ length: 1000 }, { length: 1500 }, { length: 2000 }],
        mountingType: 'PROFILE',
        mode: 'DISCRETE',
        unitLength: 500,
      });
      // totalLength = (1000+5) + (1500+5) + (2000+5) = 4515
      // quantity = CEILING(4515 / 500) = CEILING(9.03) = 10
      // driverCount = CEILING(4515 / 5000) = 1
      // wireLength = 4515 + 2000 = 6515
      expect(result.totalLength).toBe(4515);
      expect(result.quantity).toBe(10);
      expect(result.driverCount).toBe(1);
      expect(result.wireLength).toBe(6515);
    });

    it('should handle single edge', () => {
      const result = calculateLights({
        edges: [{ length: 500 }],
        mountingType: 'COVE',
        mode: 'DISCRETE',
        unitLength: 200,
      });
      // totalLength = 500 + 10 = 510
      // quantity = CEILING(510 / 200) = 3
      expect(result.totalLength).toBe(510);
      expect(result.quantity).toBe(3);
    });

    it('should handle empty edges (zero length)', () => {
      const result = calculateLights({
        edges: [],
        mountingType: 'DIRECT',
        mode: 'LINEAR',
        unitLength: 1000,
      });
      expect(result.totalLength).toBe(0);
      expect(result.quantity).toBe(0);
      expect(result.driverCount).toBe(0);
      expect(result.wireLength).toBe(2000);
    });
  });
});
