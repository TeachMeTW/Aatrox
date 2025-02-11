// src/App.jsx
import React, { Suspense, useState, useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'
import { Aatrox } from './components/Aatrox'
import CameraFollow from './components/CameraFollow'
import AbilityBar from './components/AbilityBar'
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
  const [cameraLocked, setCameraLocked] = useState(false)
  const aatroxRef = useRef()
  const controlsRef = useRef()
  // This ref will hold the champion's position at the moment of unlocking.
  const lastLockedTargetRef = useRef(new THREE.Vector3())

  // Toggle camera lock/unlock when Y is pressed.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() === 'y') {
        setCameraLocked((prevLocked) => !prevLocked)
        console.log('Camera lock toggled to:', !cameraLocked ? 'ON' : 'OFF')
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cameraLocked])

  // When unlocking (cameraLocked becomes false), update OrbitControls' target.
  useEffect(() => {
    if (!cameraLocked && controlsRef.current) {
      // Set the orbit target to the last locked target.
      controlsRef.current.target.copy(lastLockedTargetRef.current)
      controlsRef.current.update()
      console.log('OrbitControls target updated to last locked target:', lastLockedTargetRef.current)
    }
  }, [cameraLocked])

  // This callback is called from Aatrox when recall finishes.
  const handleRecallComplete = () => {
    setPanOut(true)
  }

  return (
    <div className="App" style={{ width: '100vw', height: '100vh' }}>
      <Canvas camera={{ position: [0, 1, 5], near: 0.1, far: 1000 }}>

        <ambientLight intensity={0.5} />
        <directionalLight intensity={0.8} position={[10, 10, 5]} />
        <Suspense fallback={<Html center>Loading model...</Html>}>
          <Aatrox
            ref={aatroxRef}
            position={[0, -3, 0]}
            scale={[0.025, 0.025, 0.025]}
            destination={destination}
            onRecallComplete={handleRecallComplete} // Pass the callback.
          />
        </Suspense>
        {/* When the camera is locked, disable OrbitControls */}
        <OrbitControls ref={controlsRef} enabled={!cameraLocked} />
        <RightClickHandler onRightClick={setDestination} />
        {panOut && <CameraPanOut />}
        {/* CameraFollow updates the camera only when locked */}
        <CameraFollow
          targetRef={aatroxRef}
          cameraLocked={cameraLocked}
          lastLockedTargetRef={lastLockedTargetRef}
        />
      </Canvas>
      <AbilityBar />
    </div>
  )
}

export default App
