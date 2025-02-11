// src/App.jsx
import React, { Suspense, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { Aatrox } from './components/Aatrox'
import * as THREE from 'three'
import './App.css'

/**
 * CameraPanOut smoothly pans the camera from its initial position
 * to a new, zoomed‑out position.
 */
function CameraPanOut() {
  const { camera } = useThree()

  React.useEffect(() => {
    const initialPos = camera.position.clone()
    // Adjust the target position as needed.
    const targetPos = new THREE.Vector3(0, 10, 30)
    const duration = 2000 // Duration in milliseconds

    let startTime = null
    const animate = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const t = Math.min(elapsed / duration, 1)
      camera.position.lerpVectors(initialPos, targetPos, t)
      if (t < 1) {
        requestAnimationFrame(animate)
      }
    }
    requestAnimationFrame(animate)
  }, [camera])

  return null
}

/**
 * RightClickHandler listens for right‑clicks on the canvas and computes
 * the clicked point on a ground plane at y = 0.
 */
function RightClickHandler({ onRightClick }) {
  const { camera, gl } = useThree()

  React.useEffect(() => {
    const handleContextMenu = (event) => {
      event.preventDefault()
      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const intersectionPoint = new THREE.Vector3()
      raycaster.ray.intersectPlane(groundPlane, intersectionPoint)
      if (intersectionPoint) {
        onRightClick([intersectionPoint.x, intersectionPoint.y, intersectionPoint.z])
      }
    }
    gl.domElement.addEventListener('contextmenu', handleContextMenu)
    return () => {
      gl.domElement.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [camera, gl, onRightClick])

  return null
}

function App() {
  const [destination, setDestination] = useState(null)
  const [panOut, setPanOut] = useState(false)

  // This callback is called from Aatrox when recall finishes.
  const handleRecallComplete = () => {
    setPanOut(true)
  }

  return (
    <div className="App" style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 1, 5] }}>
        <ambientLight intensity={0.5} />
        <directionalLight intensity={0.8} position={[10, 10, 5]} />
        <Suspense fallback={<Html center>Loading model...</Html>}>
          <Aatrox
            position={[0, -3, 0]}
            scale={[0.025, 0.025, 0.025]}
            destination={destination}
            onRecallComplete={handleRecallComplete} // Pass the callback.
          />
        </Suspense>
        <OrbitControls />
        <RightClickHandler onRightClick={setDestination} />
        {panOut && <CameraPanOut />}
      </Canvas>
    </div>
  )
}

export default App
