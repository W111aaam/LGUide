function Schedule() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">课表</h1>

      {/* 截图上传区域 */}
      <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-10 text-center hover:border-indigo-300 transition-colors cursor-pointer">
        <p className="text-gray-500 font-medium mb-1">上传课表截图</p>
        <p className="text-sm text-gray-400">支持 JPG / PNG 格式</p>
        <p className="text-xs text-gray-300 mt-3">（上传功能将在下一步实现）</p>
      </div>

      {/* 今日课程 */}
      <div>
        <h2 className="text-base font-semibold text-gray-600 mb-3">今日课程</h2>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-400 text-sm text-center py-4">暂无课程信息</p>
        </div>
      </div>

      {/* 课程列表 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-600">课程列表</h2>
          <button
            className="text-sm text-indigo-600 opacity-50 cursor-not-allowed"
            disabled
          >
            手动录入（待实现）
          </button>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-gray-400 text-sm text-center py-4">
            暂无课程，后续支持手动录入课程信息
          </p>
        </div>
      </div>
    </div>
  )
}

export default Schedule
