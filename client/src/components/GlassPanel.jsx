export default function GlassPanel({ className = '', children, glow }) {
  return (
    <div
      className={`glass p-6 md:p-8 ${className}`}
      style={glow ? { boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 40px ${glow}` } : undefined}
    >
      {children}
    </div>
  );
}
