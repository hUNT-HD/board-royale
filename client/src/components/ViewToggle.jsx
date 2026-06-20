/** 2D ⟷ 3D view switch — a single global control reused by both games. */
export default function ViewToggle({ view, onChange }) {
  return (
    <div className="view-toggle">
      {['2D', '3D'].map((v) => (
        <button key={v} onClick={() => onChange(v)}
          className={`view-toggle-btn ${view === v ? 'active' : ''}`}>
          {v === '3D' ? '🧊 3D' : '▦ 2D'}
        </button>
      ))}
    </div>
  );
}
