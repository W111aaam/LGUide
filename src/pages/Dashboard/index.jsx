import { Link } from 'react-router-dom'

function StatCard({ title, value, hint }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-2xl font-bold text-gray-800">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function QuickLink({ to, label }) {
  return (
    <Link
      to={to}
      className="block bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-sm px-4 py-3 rounded-lg transition-colors text-center"
    >
      {label}
    </Link>
  )
}

function Dashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">首页</h1>

      <div className="grid grid-cols-3 gap-4">
        <StatCard title="今日作业" value="—" hint="前往作业管理查看" />
        <StatCard title="今日课程" value="—" hint="前往课表查看" />
        <StatCard title="今日专注" value="0 分钟" hint="开始番茄钟计时" />
      </div>

      <div>
        <h2 className="text-base font-semibold text-gray-600 mb-3">快速入口</h2>
        <div className="grid grid-cols-4 gap-3">
          <QuickLink to="/assignments" label="作业管理" />
          <QuickLink to="/pomodoro" label="开始专注" />
          <QuickLink to="/schedule" label="查看课表" />
          <QuickLink to="/settings" label="偏好设置" />
        </div>
      </div>
    </div>
  )
}

export default Dashboard
