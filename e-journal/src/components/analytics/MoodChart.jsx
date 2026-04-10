import {
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Cell,
} from 'recharts'

const COLORS = ['#4ECDC4', '#F38181', '#FFD166', '#A29BFE', '#FF8FAB', '#7F8C8D']

function MoodChart({ data }) {
  return (
    <section className="analytics-card analytics-card--chart" aria-label="Mood distribution chart">
      <div className="analytics-card-head">
        <h3 className="analytics-section-title">Mood Distribution</h3>
      </div>
      {data.length === 0 ? (
        <p className="analytics-empty-inline">No mood records in this period.</p>
      ) : (
        <div className="analytics-chart-wrap">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={110}
                label
              >
                {data.map((item, idx) => (
                  <Cell key={item.id} fill={COLORS[idx % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}

export default MoodChart
