import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'

const GITHUB_OWNER = 'Nerolithos'
const GITHUB_REPO = 'CUHKSZ_SDS_EXAMS'
const GITHUB_BRANCH = 'main'
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`
const ARCHIVE_URLS = [
  `https://codeload.github.com/${GITHUB_OWNER}/${GITHUB_REPO}/zip/refs/heads/${GITHUB_BRANCH}`,
  `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/archive/refs/heads/${GITHUB_BRANCH}.zip`,
]

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const outputPath = path.join(projectRoot, 'public', 'resources-data.json')

function encodePathSegments(resourcePath) {
  return resourcePath
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/')
}

function getRawDownloadUrl(resourcePath) {
  return `${RAW_BASE}/${encodePathSegments(resourcePath)}`
}

function getGitHubFileUrl(resourcePath) {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${encodePathSegments(resourcePath)}`
}

async function fetchArchiveBuffer() {
  let lastError = null

  for (const url of ARCHIVE_URLS) {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'LGGuide-resource-builder',
          },
        })

        if (!response.ok) {
          throw new Error(`资源归档下载失败：${response.status} ${response.statusText}`)
        }

        return response.arrayBuffer()
      } catch (error) {
        lastError = error
      }
    }
  }

  throw lastError || new Error('资源归档下载失败')
}

function isVisibleRootItem(item) {
  return !item.name.startsWith('.') && item.name.toLowerCase() !== 'readme.md'
}

function isVisibleFileName(name) {
  return name !== '.DS_Store'
}

function getTopLevelItemsFromArchive(zip) {
  const allEntries = Object.values(zip.files)
  const rootPrefix = allEntries[0]?.name.split('/')[0]

  if (!rootPrefix) {
    return []
  }

  const itemMap = new Map()

  function ensureItem(name, type) {
    if (!itemMap.has(name)) {
      itemMap.set(name, {
        name,
        path: name,
        type,
        fileCount: 0,
        files: [],
      })
    }

    const existingItem = itemMap.get(name)
    if (type === 'dir') {
      existingItem.type = 'dir'
    }
    return existingItem
  }

  for (const entry of allEntries) {
    const relativePath = entry.name.startsWith(`${rootPrefix}/`)
      ? entry.name.slice(rootPrefix.length + 1)
      : ''

    if (!relativePath) {
      continue
    }

    const segments = relativePath.split('/').filter(Boolean)
    if (segments.length === 0) {
      continue
    }

    const topLevelName = segments[0]
    if (!isVisibleRootItem({ name: topLevelName })) {
      continue
    }

    if (segments.length === 1 && entry.dir) {
      ensureItem(topLevelName, 'dir')
      continue
    }

    if (entry.dir) {
      ensureItem(topLevelName, 'dir')
      continue
    }

    const fileName = segments[segments.length - 1]
    if (!isVisibleFileName(fileName)) {
      continue
    }

    const parentItem = ensureItem(topLevelName, segments.length === 1 ? 'file' : 'dir')
    parentItem.files.push({
      name: fileName,
      path: relativePath,
      size: entry._data?.uncompressedSize || 0,
      downloadUrl: getRawDownloadUrl(relativePath),
      htmlUrl: getGitHubFileUrl(relativePath),
    })
  }

  return Array.from(itemMap.values())
    .map(item => ({
      ...item,
      files: item.files.sort((left, right) => left.path.localeCompare(right.path)),
      fileCount: item.files.length,
    }))
    .sort((left, right) => {
      if (left.type === right.type) {
        return left.name.localeCompare(right.name)
      }
      return left.type === 'dir' ? -1 : 1
    })
}

async function main() {
  const archiveBuffer = await fetchArchiveBuffer()
  const zip = await JSZip.loadAsync(archiveBuffer)
  const items = getTopLevelItemsFromArchive(zip)

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceRepo: `${GITHUB_OWNER}/${GITHUB_REPO}`,
    branch: GITHUB_BRANCH,
    items,
  }

  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`Generated ${outputPath} with ${items.length} top-level items.`)
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})