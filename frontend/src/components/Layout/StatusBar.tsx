export function StatusBar() {
  return (
    <div className="status-bar" data-testid="status-bar">
      <span className="status-bar__item" data-testid="status-bar-hash">
        snapshot: —
      </span>
      <span className="status-bar__item" data-testid="status-bar-engine">
        engine: v1.0.0
      </span>
      <span className="status-bar__item" data-testid="status-bar-errors">
        errors: 0
      </span>
    </div>
  );
}
