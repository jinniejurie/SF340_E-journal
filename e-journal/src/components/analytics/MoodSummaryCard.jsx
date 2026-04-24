function MoodSummaryCard({ totalEntries, activeDays, topMood }) {
  return (
    <section className="analytics-summary-grid" aria-label="Monthly mood summary">
      <article className="analytics-card analytics-card--stat">
        <p className="analytics-card-label">Total entries</p>
        <h3 className="analytics-card-value">{totalEntries}</h3>
      </article>
      <article className="analytics-card analytics-card--stat">
        <p className="analytics-card-label">Active days</p>
        <h3 className="analytics-card-value">{activeDays}</h3>
      </article>
      <article className="analytics-card analytics-card--stat">
        <p className="analytics-card-label">Top mood</p>
        <h3 className="analytics-card-value">{topMood}</h3>
      </article>
    </section>
  )
}

export default MoodSummaryCard
