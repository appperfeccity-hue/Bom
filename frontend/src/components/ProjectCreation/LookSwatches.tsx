import type { DesignFamilyMaster } from '@/types/database';

interface LookSwatchesProps {
  designFamilies: DesignFamilyMaster[];
  activeDesignFamilyId: string | null;
  onDesignFamilySelect: (id: string | null) => void;
}

/** Maps design family names to visual emoji/icon representations */
const SWATCH_ICONS: Record<string, string> = {
  Marble: '\u25C7',
  Wooden: '\u25A0',
  Modern: '\u25CF',
  Minimalist: '\u25CB',
  Classic: '\u2726',
  Premium: '\u2605',
  Contemporary: '\u25C6',
  Traditional: '\u2736',
};

/** Maps design family names to gradient backgrounds */
const SWATCH_BACKGROUNDS: Record<string, string> = {
  Marble: 'linear-gradient(135deg, #f0ece4, #d4cfc5)',
  Wooden: 'linear-gradient(135deg, #e8d5b7, #a0845c)',
  Modern: 'linear-gradient(135deg, #e8e8e8, #b0b0b0)',
  Minimalist: 'linear-gradient(135deg, #fafafa, #e0e0e0)',
  Classic: 'linear-gradient(135deg, #f5e6d3, #c4a882)',
  Premium: 'linear-gradient(135deg, #f5e0c0, #9a7b4f)',
};

const DEFAULT_BACKGROUND = 'linear-gradient(135deg, #f5f0ea, #d4c9b8)';

/**
 * LookSwatches - horizontal row of circular visual swatches representing design families.
 */
export function LookSwatches({ designFamilies, activeDesignFamilyId, onDesignFamilySelect }: LookSwatchesProps) {
  if (designFamilies.length === 0) return null;

  return (
    <div className="dl-look-swatches" data-testid="look-swatches">
      <h3 className="dl-look-swatches__title">Explore all looks</h3>
      <div className="dl-look-swatches__scroll">
        {designFamilies.map((family) => {
          const isActive = activeDesignFamilyId === family.design_family_id;
          return (
            <div
              key={family.design_family_id}
              className={`dl-look-swatch${isActive ? ' dl-look-swatch--active' : ''}`}
              onClick={() => onDesignFamilySelect(isActive ? null : family.design_family_id)}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              aria-label={`Filter by ${family.name}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDesignFamilySelect(isActive ? null : family.design_family_id);
                }
              }}
            >
              <div
                className="dl-look-swatch__circle"
                style={{ background: SWATCH_BACKGROUNDS[family.name] || DEFAULT_BACKGROUND }}
              >
                {SWATCH_ICONS[family.name] || '\u25CF'}
              </div>
              <span className="dl-look-swatch__label">{family.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
