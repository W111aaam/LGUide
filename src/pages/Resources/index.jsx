import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

const GITHUB_OWNER = 'Nerolithos'
const GITHUB_REPO = 'CUHKSZ_SDS_EXAMS'
const GITHUB_BRANCH = 'main'
const RESOURCES_DATA_PATH = '/resources-data.json'

function getGitHubTreeUrl(path) {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/tree/${GITHUB_BRANCH}/${path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')}`
}

function getGitHubFileUrl(path) {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${path
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')}`
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`资料数据加载失败：${response.status}`)
  }
  return response.json()
}

function formatFileCount(count) {
  return `${count} 个文件`
}

function formatFileSize(size) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`
  }
  return `${size} B`
}

function ResourceCard({ item }) {
  return (
    <Link
      to={`/resources/${encodeURIComponent(item.name)}`}
      className="group block rounded-[1.6rem] border border-gray-200 bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_18px_45px_rgba(154,52,18,0.08)] dark:border-slate-700 dark:bg-slate-900/80 dark:hover:border-orange-400/30"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-orange-400">
            {item.type === 'dir' ? 'Folder' : 'File'}
          </p>
          <h2 className="mt-3 text-lg font-bold text-gray-900 dark:text-slate-100">{item.name}</h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">{formatFileCount(item.fileCount)}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-300">
          {item.type === 'dir' ? '课程目录' : '单文件'}
        </span>
      </div>
    </Link>
  )
}

function Resources() {
  const { resourceName } = useParams()
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCancelled = false

    async function loadResources() {
      setIsLoading(true)
      setError('')

      try {
        const resourceData = await fetchJson(RESOURCES_DATA_PATH)

        if (isCancelled) return

        setItems(resourceData.items || [])
      } catch (loadError) {
        if (isCancelled) return
        setError(loadError.message || '资料数据加载失败')
      } finally {
        if (!isCancelled) {
          setIsLoading(false)
        }
      }
    }

    loadResources()

    return () => {
      isCancelled = true
    }
  }, [])

  const activeItem = useMemo(() => {
    if (!resourceName) {
      return null
    }

    const decodedName = decodeURIComponent(resourceName)
    return items.find(item => item.name === decodedName) || null
  }, [items, resourceName])

  const activeFiles = activeItem ? activeItem.files || [] : []

  const isDetailPage = Boolean(resourceName)

  const detailMissing = isDetailPage && !isLoading && !activeItem

  const rootCards = useMemo(
    () => items.map(item => <ResourceCard key={item.path} item={item} />),
    [items],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {isDetailPage && (
            <Link
              to="/resources"
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              返回资料目录
            </Link>
          )}
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-orange-400">Resources</p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-slate-100">
            {activeItem ? activeItem.name : '资料'}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">
            数据源来自
            {' '}
            <a
              href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-orange-300 dark:hover:text-orange-200"
            >
              {GITHUB_OWNER}/{GITHUB_REPO}
            </a>
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-200">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-[1.8rem] border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
          正在读取仓库结构...
        </div>
      ) : detailMissing ? (
        <div className="rounded-[1.8rem] border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-400">
          没有找到对应的资料目录。
        </div>
      ) : isDetailPage && activeItem ? (
        <section className="rounded-[1.8rem] border border-gray-200 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-slate-700 dark:bg-slate-900/80 dark:shadow-[0_18px_50px_rgba(0,0,0,0.22)] sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-indigo-400">Files</p>
              <h2 className="mt-2 text-xl font-bold text-gray-900 dark:text-slate-100">{activeItem.name}</h2>
              <p className="mt-2 text-sm text-gray-500 dark:text-slate-400">{formatFileCount(activeItem.fileCount)}</p>
            </div>
            <a
              href={activeItem.type === 'dir' ? getGitHubTreeUrl(activeItem.path) : getGitHubFileUrl(activeItem.path)}
              target="_blank"
              rel="noopener noreferrer"
              className="self-start rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              在 GitHub 中查看
            </a>
          </div>

          <div className="mt-5 space-y-3">
            {activeFiles.length > 0 ? (
              activeFiles.map(file => (
                <div
                  key={file.path}
                  className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-950/80 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">{file.name}</p>
                    <p className="mt-1 truncate text-xs text-gray-500 dark:text-slate-400">{file.path}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-gray-500 dark:bg-slate-800 dark:text-slate-300">
                      {formatFileSize(file.size)}
                    </span>
                    <a
                      href={file.downloadUrl}
                      download
                      className="rounded-full bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-gray-800 dark:bg-orange-300 dark:text-slate-950 dark:hover:bg-orange-200"
                    >
                      下载
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
                当前目录下没有可下载文件。
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rootCards}
        </section>
      )}
    </div>
  )
}

export default Resources