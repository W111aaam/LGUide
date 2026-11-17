import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import { createBlackboardPairingCode, createBlackboardSyncToken, disconnectBlackboard, fetchBlackboardData } from '../../utils/blackboardApi'

function formatTime(value, isEnglish) {
  if (!value) return isEnglish ? 'Never synced' : '尚未同步'
  return new Intl.DateTimeFormat(isEnglish ? 'en' : 'zh-CN', {
    timeZone: 'Asia/Shanghai', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function EmptyState({ children }) {
  return <div className="rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center text-sm text-gray-400 dark:border-slate-700">{children}</div>
}

export default function Blackboard() {
  const { user } = useAuth()
  return <BlackboardPage key={user?.id || 'guest'} user={user} />
}

function BlackboardPage({ user }) {
  const { isEnglish } = useLanguage()
  const [data, setData] = useState(null)
  const [pairing, setPairing] = useState(null)
  const [manualAvailable, setManualAvailable] = useState(false)
  const [manualToken, setManualToken] = useState('')
  const [windows, setWindows] = useState(() => /Windows/i.test(navigator.userAgent))
  const [activeTab, setActiveTab] = useState('tasks')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const text = isEnglish ? {
    title: 'Blackboard Sync', subtitle: 'Assignments, announcements and course materials from bbwatch.',
    login: 'Log in to LGUide first to connect your Blackboard data.', connect: 'Connect Blackboard', reconnect: 'Reconnect',
    disconnect: 'Disconnect', lastSync: 'Last sync', never: 'No data has been synced yet.', tasks: 'Assignments & DDL',
    announcements: 'Announcements', materials: 'Course materials', courses: 'courses', copy: 'Copy setup command', copied: 'Copied',
    setup: 'Copy the command into Terminal (macOS/Linux) or PowerShell (Windows). Python 3.11+ is required. If prompted, enter your school login on this device.',
    expiry: 'This command works once and expires after 10 minutes. Keep this page open to see the first sync.',
    copyError: 'Copy failed. Select and copy the command manually.',
    emptyTasks: 'No Blackboard assignments yet.', emptyAnnouncements: 'No announcements yet.', emptyMaterials: 'No course materials yet.',
  } : {
    title: 'Blackboard 同步', subtitle: '通过 bbwatch 自动汇总作业、DDL、课程公告与课件。',
    login: '请先登录 LGUide，再连接你的 Blackboard 数据。', connect: '连接 Blackboard', reconnect: '重新连接',
    disconnect: '断开连接', lastSync: '最近同步', never: '尚未同步数据。', tasks: '作业与 DDL',
    announcements: '课程公告', materials: '课件', courses: '门课程', copy: '复制配置命令', copied: '已复制',
    setup: '将命令粘贴到 macOS/Linux 的终端或 Windows 的 PowerShell。需要 Python 3.11 或更新版本。首次使用时，按本机提示输入学校账号和密码。',
    expiry: '命令只能用一次，10 分钟后失效。保持此页打开即可看到首次同步结果。',
    copyError: '复制失败，请手动选中并复制命令。',
    emptyTasks: '暂无 Blackboard 作业。', emptyAnnouncements: '暂无课程公告。', emptyMaterials: '暂无课件数据。',
  }

  const refresh = useCallback(async () => {
    if (!user) return
    setLoading(true); setError('')
    try { setData(await fetchBlackboardData()) } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    if (!pairing) return
    let stopped = false
    let timer
    async function checkSync() {
      try {
        const next = await fetchBlackboardData()
        if (stopped) return
        if (next.status?.last_sync_at > pairing.created_at) {
          setData(next)
          setPairing(null)
          return
        }
      } catch {
        // Retry during setup, including after a transient network failure.
      }
      if (!stopped && Date.now() < Date.parse(pairing.expires_at) + 300_000) {
        timer = window.setTimeout(checkSync, 5000)
      }
    }
    timer = window.setTimeout(checkSync, 5000)
    return () => { stopped = true; window.clearTimeout(timer) }
  }, [pairing])

  const command = pairing && /^[A-Z2-9]{5}-[A-Z2-9]{5}$/.test(pairing.code)
    ? `${windows ? 'py -3' : 'python3'} -c "from urllib.request import urlopen; exec(compile(urlopen('https://raw.githubusercontent.com/W111aaam/LGUide/main/public/bbwatch-setup.py', timeout=30).read(), 'bbwatch-setup.py', 'exec'))" ${pairing.code}`
    : ''

  async function createPairing() {
    setLoading(true); setError(''); setCopied(false)
    try {
      setPairing(await createBlackboardPairingCode())
      setManualAvailable(false)
      setManualToken('')
    } catch (e) {
      if (e.status === 404) setManualAvailable(true)
      else setError(e.message)
    } finally { setLoading(false) }
  }

  async function createManualToken() {
    setLoading(true); setError('')
    try {
      setManualToken((await createBlackboardSyncToken()).token)
      await refresh()
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
    } catch {
      setError(text.copyError)
    }
  }

  async function disconnect() {
    if (!window.confirm(isEnglish ? 'Disconnect and remove synced Blackboard data?' : '确认断开连接并删除已同步的 Blackboard 数据？')) return
    setLoading(true); setError('')
    try { await disconnectBlackboard(); setPairing(null); setManualToken(''); setData(null); await refresh() } catch (e) { setError(e.message) } finally { setLoading(false) }
  }

  if (!user) return <EmptyState>{text.login}</EmptyState>

  const status = data?.status
  const tabs = [
    ['tasks', text.tasks, data?.tasks?.length || 0],
    ['announcements', text.announcements, data?.announcements?.length || 0],
    ['materials', text.materials, data?.materials?.length || 0],
  ]

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-indigo-100 bg-gradient-to-br from-white to-indigo-50/70 p-6 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-indigo-950/30">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-indigo-500">CUHK-SZ · bbwatch</p><h1 className="text-3xl font-bold text-gray-900 dark:text-white">{text.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500 dark:text-slate-400">{text.subtitle}</p></div>
          <div className="flex gap-2">
            <button onClick={createPairing} disabled={loading} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{status?.connected ? text.reconnect : text.connect}</button>
            {status?.connected && <button onClick={disconnect} className="rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-500 hover:bg-white dark:border-slate-700">{text.disconnect}</button>}
          </div>
        </div>
        {status?.connected && <div className="mt-5 flex flex-wrap gap-3 text-xs text-gray-500"><span className="rounded-full bg-white/80 px-3 py-1.5 dark:bg-slate-800">{text.lastSync}: {formatTime(status.last_sync_at, isEnglish)}</span><span className="rounded-full bg-white/80 px-3 py-1.5 dark:bg-slate-800">{status.counts?.courses || 0} {text.courses}</span></div>}
        {command && (
          <div className="mt-5 space-y-3 rounded-2xl border border-indigo-100 bg-white p-4 dark:border-slate-700">
            <p className="text-sm text-gray-600">{text.setup}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={!windows} onClick={() => { setWindows(false); setCopied(false) }} className="rounded-lg border px-3 py-2 text-xs aria-pressed:border-indigo-500">macOS / Linux</button>
              <button type="button" aria-pressed={windows} onClick={() => { setWindows(true); setCopied(false) }} className="rounded-lg border px-3 py-2 text-xs aria-pressed:border-indigo-500">Windows</button>
              <button type="button" onClick={copyCommand} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white">{copied ? text.copied : text.copy}</button>
            </div>
            <code className="block overflow-x-auto whitespace-nowrap rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{command}</code>
            <p className="text-xs text-gray-500">{text.expiry}</p>
          </div>
        )}
        {manualAvailable && (
          <div className="mt-5 space-y-3 rounded-2xl border border-amber-200 p-4 text-sm text-gray-600">
            <p>{isEnglish ? 'Quick setup is not available on this server yet. If bbwatch is already installed, you can connect manually.' : '服务器暂未开通快速连接。已安装 bbwatch 的用户可以手动连接。'}</p>
            {!manualToken && <button type="button" disabled={loading} onClick={createManualToken} className="rounded-lg border px-3 py-2">{isEnglish ? 'Generate manual sync token' : '生成手动同步令牌'}</button>}
            {manualToken && <>
              <p>{isEnglish ? 'Run this command, then paste the token below at the hidden prompt.' : '运行下方命令，再将令牌粘贴到终端的隐藏输入提示中。'}</p>
              <code className="block overflow-x-auto">bbwatch lguide-connect</code>
              <code className="block overflow-x-auto">{manualToken}</code>
            </>}
          </div>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
      </section>

      {!status?.connected ? <EmptyState>{text.never}</EmptyState> : <>
        <div className="flex gap-2 overflow-x-auto">{tabs.map(([id, label, count]) => <button key={id} onClick={() => setActiveTab(id)} className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ${activeTab === id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white text-gray-500 dark:bg-slate-900 dark:text-slate-400'}`}>{label} · {count}</button>)}</div>
        {loading && !data ? <EmptyState>Loading…</EmptyState> : activeTab === 'tasks' ? <div className="space-y-3">{data.tasks?.length ? data.tasks.map(item => <article key={item.entity_key} className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div><p className="text-xs font-semibold text-indigo-500">{item.course_name || item.course_id}</p><h2 className="mt-1 font-semibold text-gray-900 dark:text-white">{item.title}</h2><p className="mt-1 text-xs text-gray-400">{item.status}</p></div><time className="shrink-0 text-sm font-semibold text-gray-600 dark:text-slate-300">{formatTime(item.due_utc, isEnglish)}</time></article>) : <EmptyState>{text.emptyTasks}</EmptyState>}</div>
        : activeTab === 'announcements' ? <div className="grid gap-3 md:grid-cols-2">{data.announcements?.length ? data.announcements.map(item => <article key={item.entity_key} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold text-indigo-500">{item.course_name || item.course_id}</p><h2 className="mt-1 font-semibold text-gray-900 dark:text-white">{item.title}</h2><p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">{item.body}</p><time className="mt-3 block text-xs text-gray-400">{formatTime(item.created_utc, isEnglish)}</time></article>) : <EmptyState>{text.emptyAnnouncements}</EmptyState>}</div>
        : <div className="grid gap-3 md:grid-cols-2">{data.materials?.length ? data.materials.map(item => <article key={item.entity_key} className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><p className="text-xs font-semibold text-indigo-500">{item.course_name || item.course_id}</p><h2 className="mt-1 font-semibold text-gray-900 dark:text-white">{item.title}</h2><div className="mt-3 flex items-center justify-between text-xs text-gray-400"><span>{item.downloaded ? (isEnglish ? 'Downloaded locally' : '已下载到本机') : (isEnglish ? 'Available' : '可用')}</span><time>{formatTime(item.modified_utc, isEnglish)}</time></div></article>) : <EmptyState>{text.emptyMaterials}</EmptyState>}</div>}
      </>}
    </div>
  )
}
