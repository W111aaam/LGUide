import { lazy, Suspense, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLanguage } from '../../context/LanguageContext'
import { orbitModels } from '../../components/home/heroModels'

const ThreeHeroOrbit = lazy(() => import('../../components/home/ThreeHeroOrbit'))

function FeatureFallback({ isEnglish }) {
  const navigate = useNavigate()

  function open(item) {
    if (item.href) window.open(item.href, '_blank', 'noopener,noreferrer')
    else if (item.route) navigate(item.route)
  }

  return (
    <div className="home-fallback">
      <p>{isEnglish ? 'Interactive 3D view unavailable' : '交互式 3D 视图暂不可用'}</p>
      <div className="home-fallback-grid">
        {orbitModels.map(item => (
          <button key={item.id} type="button" onClick={() => open(item)}>{item.name}</button>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const { isEnglish } = useLanguage()
  const [unavailable, setUnavailable] = useState(false)
  const text = isEnglish
    ? {
        eyebrow: 'A smarter campus command center',
        title: 'Your Campus Life, in One Orbit.',
        description: 'Courses, resources, deadlines, focus sessions and writing tools — all moving in sync with your university life.',
        dashboard: 'Open Dashboard',
        explore: 'Start Exploring',
        hint: 'Hover to pause · Click to open',
      }
    : {
        eyebrow: '更聪明的校园效率中心',
        title: '你的校园生活，有序运转。',
        description: '课程、资料、Deadline、番茄钟与编辑助手，都围绕你的大学生活有序运转。',
        dashboard: '打开仪表盘',
        explore: '开始探索',
        hint: '悬停暂停 · 点击进入',
      }

  return (
    <section className="home-hero">
      <div className="home-hero-copy">
        <p className="home-hero-eyebrow"><span />{text.eyebrow}</p>
        <h1>{text.title}</h1>
        <p className="home-hero-description">{text.description}</p>
        <div className="home-hero-actions">
          <Link to="/dashboard" className="home-primary-action">{text.dashboard}</Link>
          <Link to="/resources" className="home-secondary-action">{text.explore}<span aria-hidden="true">→</span></Link>
        </div>
        <p className="home-hero-hint"><span />{text.hint}</p>
      </div>
      <div className="home-hero-visual">
        <div className="home-hero-glow" />
        {unavailable ? (
          <FeatureFallback isEnglish={isEnglish} />
        ) : (
          <Suspense fallback={<div className="home-canvas-placeholder">3D view is loading...</div>}>
            <ThreeHeroOrbit onUnavailable={() => setUnavailable(true)} />
          </Suspense>
        )}
      </div>
    </section>
  )
}
