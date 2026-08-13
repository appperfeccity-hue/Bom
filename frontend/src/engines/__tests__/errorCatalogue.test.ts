import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  ErrorSeverity,
  ErrorCategory,
  ERROR_DEFINITIONS,
  createPipelineError,
} from '../errorCatalogue';

describe('errorCatalogue', () => {
  describe('ErrorCode enum', () => {
    it('should have 33 error codes', () => {
      const codes = Object.values(ErrorCode);
      expect(codes).toHaveLength(33);
    });

    it('should have all unique error codes', () => {
      const codes = Object.values(ErrorCode);
      const uniqueCodes = new Set(codes);
      expect(uniqueCodes.size).toBe(codes.length);
    });

    it('should have 19 geometry codes', () => {
      const geoCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('GEO_')
      );
      expect(geoCodes).toHaveLength(19);
    });

    it('should have 3 construction codes', () => {
      const constCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('CONST_')
      );
      expect(constCodes).toHaveLength(3);
    });

    it('should have 2 compatibility codes', () => {
      const compatCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('COMPAT_')
      );
      expect(compatCodes).toHaveLength(2);
    });

    it('should have 3 permission codes', () => {
      const permCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('PERM_')
      );
      expect(permCodes).toHaveLength(3);
    });

    it('should have 1 quantity code', () => {
      const qtyCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('QTY_')
      );
      expect(qtyCodes).toHaveLength(1);
    });
  });

  describe('ERROR_DEFINITIONS', () => {
    it('should have a definition for every error code', () => {
      const codes = Object.values(ErrorCode);
      for (const code of codes) {
        expect(ERROR_DEFINITIONS[code]).toBeDefined();
      }
    });

    it('should have non-empty messageTemplate for every error', () => {
      const codes = Object.values(ErrorCode);
      for (const code of codes) {
        const def = ERROR_DEFINITIONS[code];
        expect(def.messageTemplate).toBeTruthy();
        expect(def.messageTemplate.length).toBeGreaterThan(0);
      }
    });

    it('should have valid severity for every error', () => {
      const codes = Object.values(ErrorCode);
      const validSeverities = Object.values(ErrorSeverity);
      for (const code of codes) {
        expect(validSeverities).toContain(ERROR_DEFINITIONS[code].severity);
      }
    });

    it('should have valid category for every error', () => {
      const codes = Object.values(ErrorCode);
      const validCategories = Object.values(ErrorCategory);
      for (const code of codes) {
        expect(validCategories).toContain(ERROR_DEFINITIONS[code].category);
      }
    });

    it('should assign GEOMETRY category to GEO_ codes', () => {
      const geoCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('GEO_')
      );
      for (const code of geoCodes) {
        expect(ERROR_DEFINITIONS[code].category).toBe(ErrorCategory.GEOMETRY);
      }
    });

    it('should assign CONSTRUCTION category to CONST_ codes', () => {
      const constCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('CONST_')
      );
      for (const code of constCodes) {
        expect(ERROR_DEFINITIONS[code].category).toBe(ErrorCategory.CONSTRUCTION);
      }
    });

    it('should assign COMPATIBILITY category to COMPAT_ codes', () => {
      const compatCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('COMPAT_')
      );
      for (const code of compatCodes) {
        expect(ERROR_DEFINITIONS[code].category).toBe(
          ErrorCategory.COMPATIBILITY
        );
      }
    });

    it('should assign PERMISSION category to PERM_ codes', () => {
      const permCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('PERM_')
      );
      for (const code of permCodes) {
        expect(ERROR_DEFINITIONS[code].category).toBe(ErrorCategory.PERMISSION);
      }
    });

    it('should assign QUANTITY category to QTY_ codes', () => {
      const qtyCodes = Object.values(ErrorCode).filter((c) =>
        c.startsWith('QTY_')
      );
      for (const code of qtyCodes) {
        expect(ERROR_DEFINITIONS[code].category).toBe(ErrorCategory.QUANTITY);
      }
    });
  });

  describe('createPipelineError', () => {
    it('should create a PipelineError from an error code', () => {
      const error = createPipelineError(ErrorCode.GEO_ZONE_OVERLAP);
      expect(error.code).toBe(ErrorCode.GEO_ZONE_OVERLAP);
      expect(error.severity).toBe(ErrorSeverity.BLOCKING);
      expect(error.category).toBe(ErrorCategory.GEOMETRY);
      expect(error.message).toBe('Zones overlap each other');
    });

    it('should include context when provided', () => {
      const error = createPipelineError(ErrorCode.GEO_ZONE_OVERLAP, {
        zoneA: 'z1',
        zoneB: 'z2',
      });
      expect(error.context).toEqual({ zoneA: 'z1', zoneB: 'z2' });
    });

    it('should not include context key when context is undefined', () => {
      const error = createPipelineError(ErrorCode.GEO_ZONE_TOO_SMALL);
      expect(error).not.toHaveProperty('context');
    });

    it('should use the messageTemplate from ERROR_DEFINITIONS', () => {
      const codes = Object.values(ErrorCode);
      for (const code of codes) {
        const error = createPipelineError(code);
        expect(error.message).toBe(ERROR_DEFINITIONS[code].messageTemplate);
      }
    });

    it('should correctly map severity from definitions', () => {
      const error = createPipelineError(ErrorCode.GEO_GAP_TOO_SMALL);
      expect(error.severity).toBe(ErrorSeverity.WARNING);
    });
  });
});
