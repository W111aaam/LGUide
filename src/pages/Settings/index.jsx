function SettingRow({ label, description, badge }) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && (
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        )}
      </div>
      <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
        {badge}
      </span>
    </div>
  )
}

function Settings() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">设置</h1>

      <div className="bg-white border border-gray-200 rounded-xl px-5">
        <SettingRow
          label="网站主题"
          description="浅色 / 深色主题切换"
          badge="待实现"
        />
        <SettingRow
          label="番茄钟时长"
          description="单次专注时间（分钟）"
          badge="25 分钟"
        />
        <SettingRow
          label="短休息时长"
          description="每个番茄钟后的短休息"
          badge="5 分钟"
        />
        <SettingRow
          label="长休息时长"
          description="每 4 个番茄钟后的长休息"
          badge="15 分钟"
        />
        <SettingRow
          label="更多设置"
          description="后续版本将支持更多偏好配置"
          badge="待规划"
        />
      </div>
    </div>
  )
}

export default Settings
