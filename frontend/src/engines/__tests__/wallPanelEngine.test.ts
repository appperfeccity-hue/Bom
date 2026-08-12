import { describe, it, expect } from 'vitest';
import { calculateWallPanels } from '../wallPanelEngine';
import { EngineError } from '../types';

describe('wallPanelEngine', () => {
  describe('golden test fixtures', () => {
    it('PANEL-001: W=2400, w=1200, gh=0 -> Ncol=2, exact fit, trim=0', () => {
      const result = calculateWallPanels({
        W: 2400,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(2);
      expect(result.trimWidth).toBe(0);
      expect(result.retainedWidth).toBe(1200);
    });

    it('PANEL-002: W=2400, w=1200, gh=2 -> Ncol=2, total_span=2402, trim=1mm/side, retained=1199', () => {
      const result = calculateWallPanels({
        W: 2400,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 2,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(2);
      expect(result.trimWidth).toBe(1);
      expect(result.retainedWidth).toBe(1199);
    });

    it('PANEL-003: W=1200, w=1200, gh=0 -> Ncol=1, single panel exact, trim=0, retained=1200', () => {
      const result = calculateWallPanels({
        W: 1200,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(1);
      expect(result.trimWidth).toBe(0);
      expect(result.retainedWidth).toBe(1200);
    });

    it('PANEL-004: W=2450, w=1200, gh=0 -> Ncol=3, total_span=3600, trim=575mm/side, retained=625', () => {
      const result = calculateWallPanels({
        W: 2450,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(3);
      expect(result.trimWidth).toBe(575);
      expect(result.retainedWidth).toBe(625);
    });

    it('PANEL-005: W=2400, H=2400, w=1200, h=1200, gh=0, gv=0 -> Ncol=2, Nrow=2, required=4', () => {
      const result = calculateWallPanels({
        W: 2400,
        H: 2400,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(2);
      expect(result.Nrow).toBe(2);
      expect(result.requiredQuantity).toBe(4);
    });

    it('PANEL-006: W=1199, w=1200, gh=0 -> Ncol=1, single panel, trim=1, retained=1199', () => {
      const result = calculateWallPanels({
        W: 1199,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(1);
      expect(result.trimWidth).toBe(1);
      expect(result.retainedWidth).toBe(1199);
    });

    it('PANEL-007: W=2450, w=1225, gh=0 -> Ncol=2, exact fit 2*1225=2450, trim=0', () => {
      const result = calculateWallPanels({
        W: 2450,
        H: 1200,
        w: 1225,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(2);
      expect(result.trimWidth).toBe(0);
      expect(result.retainedWidth).toBe(1225);
    });

    it('PANEL-008: W=3000, w=1200, gh=2 -> Ncol=3, total_span=3604, trim=302mm/side, retained=898', () => {
      const result = calculateWallPanels({
        W: 3000,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 2,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(3);
      expect(result.trimWidth).toBe(302);
      expect(result.retainedWidth).toBe(898);
    });

    it('PANEL-009: W=1000, w=600, gh=0 -> Ncol=2, total_span=1200, trim=100mm/side, retained=500', () => {
      const result = calculateWallPanels({
        W: 1000,
        H: 600,
        w: 600,
        h: 600,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(2);
      expect(result.trimWidth).toBe(100);
      expect(result.retainedWidth).toBe(500);
    });

    it('PANEL-010: W=100, w=600, gh=0 -> Ncol=1, single panel trimmed to 100, trim=500, retained=100', () => {
      const result = calculateWallPanels({
        W: 100,
        H: 600,
        w: 600,
        h: 600,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(1);
      expect(result.trimWidth).toBe(500);
      expect(result.retainedWidth).toBe(100);
    });

    it('PANEL-011: W=2700, w=1200, gh=0 -> Ncol=3, total_span=3600, trim=450mm/side, retained=750', () => {
      const result = calculateWallPanels({
        W: 2700,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(3);
      expect(result.trimWidth).toBe(450);
      expect(result.retainedWidth).toBe(750);
    });

    it('PANEL-012: W=50, w=1200, gh=0 -> Ncol=1, single panel, trim=1150, retained=50 (boundary)', () => {
      const result = calculateWallPanels({
        W: 50,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(1);
      expect(result.trimWidth).toBe(1150);
      expect(result.retainedWidth).toBe(50);
    });

    it('PANEL-013: W=49, w=1200, gh=0 -> MUST THROW EngineError (retained 49mm < 50mm MIN_RETAINED)', () => {
      expect(() =>
        calculateWallPanels({
          W: 49,
          H: 1200,
          w: 1200,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });
  });

  describe('waste factor', () => {
    it('should apply waste factor correctly', () => {
      const result = calculateWallPanels({
        W: 2400,
        H: 2400,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0.1,
      });
      expect(result.requiredQuantity).toBe(4);
      // CEILING(4 * 1.1) = CEILING(4.4) = 5
      expect(result.procurementQuantity).toBe(5);
      expect(result.wasteQuantity).toBe(1);
    });

    it('should return zero waste when wasteFactor is 0', () => {
      const result = calculateWallPanels({
        W: 2400,
        H: 1200,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.requiredQuantity).toBe(2);
      expect(result.procurementQuantity).toBe(2);
      expect(result.wasteQuantity).toBe(0);
    });
  });

  describe('height axis', () => {
    it('should calculate height axis independently', () => {
      const result = calculateWallPanels({
        W: 1200,
        H: 2400,
        w: 1200,
        h: 1200,
        gh: 0,
        gv: 0,
        wasteFactor: 0,
      });
      expect(result.Ncol).toBe(1);
      expect(result.Nrow).toBe(2);
      expect(result.trimHeight).toBe(0);
      expect(result.retainedHeight).toBe(1200);
    });

    it('should throw EngineError for height axis retained < 50mm', () => {
      expect(() =>
        calculateWallPanels({
          W: 1200,
          H: 49,
          w: 1200,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });
  });

  describe('input validation', () => {
    it('should throw EngineError for zero panel width', () => {
      expect(() =>
        calculateWallPanels({
          W: 2400,
          H: 1200,
          w: 0,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for negative panel width', () => {
      expect(() =>
        calculateWallPanels({
          W: 2400,
          H: 1200,
          w: -100,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for zero panel height', () => {
      expect(() =>
        calculateWallPanels({
          W: 2400,
          H: 1200,
          w: 1200,
          h: 0,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for negative panel height', () => {
      expect(() =>
        calculateWallPanels({
          W: 2400,
          H: 1200,
          w: 1200,
          h: -50,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for negative horizontal gap', () => {
      expect(() =>
        calculateWallPanels({
          W: 2400,
          H: 1200,
          w: 1200,
          h: 1200,
          gh: -5,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for negative vertical gap', () => {
      expect(() =>
        calculateWallPanels({
          W: 2400,
          H: 1200,
          w: 1200,
          h: 1200,
          gh: 0,
          gv: -3,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for zero zone width', () => {
      expect(() =>
        calculateWallPanels({
          W: 0,
          H: 1200,
          w: 1200,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for negative zone width', () => {
      expect(() =>
        calculateWallPanels({
          W: -500,
          H: 1200,
          w: 1200,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for zero zone height', () => {
      expect(() =>
        calculateWallPanels({
          W: 2400,
          H: 0,
          w: 1200,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });

    it('should throw EngineError for negative zone height', () => {
      expect(() =>
        calculateWallPanels({
          W: 2400,
          H: -100,
          w: 1200,
          h: 1200,
          gh: 0,
          gv: 0,
          wasteFactor: 0,
        }),
      ).toThrow(EngineError);
    });
  });
});
