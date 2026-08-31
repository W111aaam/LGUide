import { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import { Box3, MathUtils, Vector3 } from 'three'
import { useNavigate } from 'react-router-dom'
import { centerModel, orbitModels } from './heroModels'

function NormalizedModel({ item }) {
  const { scene } = useGLTF(item.path)
  const normalized = useMemo(() => {
    const clone = scene.clone(true)
    const box = new Box3().setFromObject(clone)
    const size = box.getSize(new Vector3())
    const center = box.getCenter(new Vector3())
    const longestSide = Math.max(size.x, size.y, size.z) || 1
    const scale = item.size / longestSide

    clone.position.set(-center.x, -center.y, -center.z)
    clone.scale.setScalar(scale)
    clone.traverse(child => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = true
      }
    })
    return clone
  }, [item.size, scene])

  return <primitive object={normalized} rotation={item.rotation} />
}

function InteractiveModel({ item, position = [0, 0, 0], hoveredId, setHoveredId, onSelect, float = false }) {
  const ref = useRef()
  const isHovered = hoveredId === item.id

  useFrame((state, delta) => {
    if (!ref.current) return
    const target = isHovered ? 1.12 : 1
    const next = MathUtils.damp(ref.current.scale.x, target, 9, delta)
    ref.current.scale.setScalar(next)
    if (float) {
      ref.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 1.15) * 0.07
    }
  })

  return (
    <group
      ref={ref}
      position={position}
      onPointerOver={event => {
        event.stopPropagation()
        setHoveredId(item.id)
        document.body.style.cursor = 'pointer'
      }}
      onPointerOut={event => {
        event.stopPropagation()
        setHoveredId(current => (current === item.id ? null : current))
        document.body.style.cursor = 'auto'
      }}
      onClick={event => {
        event.stopPropagation()
        onSelect(item)
      }}
    >
      <NormalizedModel item={item} />
    </group>
  )
}

function OrbitScene({ hoveredId, setHoveredId, onSelect }) {
  const orbitRef = useRef()
  const { viewport } = useThree()
  const radius = viewport.width < 7 ? 2.45 : 3.25

  useFrame((_, delta) => {
    if (orbitRef.current && !hoveredId) {
      orbitRef.current.rotation.y += delta * 0.105
    }
  })

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[4, 7, 5]} intensity={2.1} castShadow />
      <directionalLight position={[-5, 2, -4]} intensity={0.8} color="#a5b4fc" />
      <InteractiveModel
        item={centerModel}
        position={[0, 0.05, 0]}
        hoveredId={hoveredId}
        setHoveredId={setHoveredId}
        onSelect={onSelect}
        float
      />
      <group ref={orbitRef}>
        {orbitModels.map((item, index) => {
          const angle = (index / orbitModels.length) * Math.PI * 2
          return (
            <InteractiveModel
              key={item.id}
              item={item}
              position={[
                Math.cos(angle) * radius,
                Math.sin(index * 1.7) * 0.32,
                Math.sin(angle) * radius,
              ]}
              hoveredId={hoveredId}
              setHoveredId={setHoveredId}
              onSelect={onSelect}
            />
          )
        })}
      </group>
    </>
  )
}

function LoadingView() {
  return (
    <Html center>
      <div className="three-hero-loading">
        <span />
        <p>3D view is loading...</p>
      </div>
    </Html>
  )
}

class SceneErrorBoundary extends Component {
  state = { failed: false }

  componentDidCatch(error) {
    console.error('Unable to load the 3D home scene.', error)
    this.setState({ failed: true })
    this.props.onError()
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}

export default function ThreeHeroOrbit({ onUnavailable }) {
  const navigate = useNavigate()
  const [hoveredId, setHoveredId] = useState(null)
  const hovered = [...orbitModels, centerModel].find(item => item.id === hoveredId)

  useEffect(() => () => {
    document.body.style.cursor = 'auto'
  }, [])

  function handleSelect(item) {
    if (item.href) {
      window.open(item.href, '_blank', 'noopener,noreferrer')
    } else if (item.route) {
      navigate(item.route)
    } else {
      console.info(`${item.name} is not available yet.`)
    }
  }

  return (
    <div
      className="three-hero-canvas"
      onPointerLeave={() => {
        setHoveredId(null)
        document.body.style.cursor = 'auto'
      }}
    >
      <SceneErrorBoundary onError={onUnavailable}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 3.2, 8.7], fov: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          shadows
          onCreated={({ gl }) => {
            gl.domElement.addEventListener('webglcontextlost', onUnavailable, { once: true })
          }}
        >
          <Suspense fallback={<LoadingView />}>
            <OrbitScene hoveredId={hoveredId} setHoveredId={setHoveredId} onSelect={handleSelect} />
          </Suspense>
        </Canvas>
      </SceneErrorBoundary>
      <div className={`three-hero-label ${hovered ? 'is-visible' : ''}`} aria-live="polite">
        {hovered?.name || 'Explore the orbit'}
      </div>
    </div>
  )
}
