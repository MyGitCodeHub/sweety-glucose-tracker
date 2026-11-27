export function StatCard({ label, value, caption }) {
  return (
    <article className="stat-card">
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      {caption ? <p className="stat-caption">{caption}</p> : null}
    </article>
  );
}
