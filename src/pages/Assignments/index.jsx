import { useState, useEffect } from 'react'
import { load, save } from '../../utils/storage'

const STORAGE_KEY = 'assignments'

// 将 YYYY-MM-DD 格式化为 MM/DD 用于展示
function formatDate(dateStr) {
  if (!dateStr) return null
  const [, m, d] = dateStr.split('-')
  return `${m}/${d}`
}

// ---- 子组件：添加表单 ----

function AddForm({ onAdd, onCancel }) {
  const [form, setForm] = useState({ subject: '', title: '', dueDate: '' })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.subject.trim() || !form.title.trim()) return
    onAdd({
      id: crypto.randomUUID(),
      subject: form.subject.trim(),
      title: form.title.trim(),
      dueDate: form.dueDate,
      done: false,
      createdAt: Date.now(),
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-indigo-200 rounded-xl p-4 space-y-3"
    >
      <div className="flex gap-2 flex-wrap">
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="科目 *"
          value={form.subject}
          onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
        />
        <input
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-40 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="作业标题 *"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
        />
        <input
          type="date"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
          value={form.dueDate}
          onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg transition-colors"
        >
          确认添加
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700 px-4 py-1.5 rounded-lg transition-colors"
        >
          取消
        </button>
      </div>
    </form>
  )
}

// ---- 子组件：单条作业卡片 ----

function AssignmentItem({ item, onToggle, onDelete }) {
  return (
    <div
      className={`bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3 transition-opacity ${
        item.done ? 'opacity-60' : ''
      }`}
    >
      <input
        type="checkbox"
        checked={item.done}
        onChange={onToggle}
        className="mt-0.5 w-4 h-4 accent-indigo-600 cursor-pointer flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            item.done ? 'line-through text-gray-400' : 'text-gray-700'
          }`}
        >
          <span className="text-indigo-600 mr-1.5">{item.subject}</span>
          {item.title}
        </p>
        {item.dueDate && (
          <p className="text-xs text-gray-400 mt-0.5">
            截止：{formatDate(item.dueDate)}
          </p>
        )}
      </div>
      <button
        onClick={onDelete}
        className="text-xs text-gray-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5"
      >
        删除
      </button>
    </div>
  )
}

// ---- 主页面 ----

function Assignments() {
  const [assignments, setAssignments] = useState(() => load(STORAGE_KEY, []))
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    save(STORAGE_KEY, assignments)
  }, [assignments])

  function handleAdd(newItem) {
    setAssignments(prev => [newItem, ...prev])
    setShowForm(false)
  }

  function handleToggleDone(id) {
    setAssignments(prev =>
      prev.map(a => (a.id === id ? { ...a, done: !a.done } : a))
    )
  }

  function handleDelete(id) {
    setAssignments(prev => prev.filter(a => a.id !== id))
  }

  const pending = assignments.filter(a => !a.done)
  const done = assignments.filter(a => a.done)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">作业管理</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? '收起' : '添加作业'}
        </button>
      </div>

      {showForm && (
        <AddForm onAdd={handleAdd} onCancel={() => setShowForm(false)} />
      )}

      {assignments.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center">
          <p className="text-gray-400 text-sm">暂无作业，点击右上角添加</p>
        </div>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-500">
                待完成 · {pending.length}
              </h2>
              {pending.map(item => (
                <AssignmentItem
                  key={item.id}
                  item={item}
                  onToggle={() => handleToggleDone(item.id)}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-400">
                已完成 · {done.length}
              </h2>
              {done.map(item => (
                <AssignmentItem
                  key={item.id}
                  item={item}
                  onToggle={() => handleToggleDone(item.id)}
                  onDelete={() => handleDelete(item.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default Assignments
