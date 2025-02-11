// components/CameraFollow.jsx
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import React from 'react'

export default function CameraFollow({ targetRef, cameraLocked, lastLockedTargetRef }) {
  const { camera } = useThree()

  useFrame(() => {
    if (cameraLocked && targetRef.current) {
      // Define the desired offset for camera position.
      const offset = new THREE.Vector3(0, 5, 8)  // adjust as needed
      // Get the champion's current position.
      const targetPos = targetRef.current.position.clone()
      // Update the last locked target.
      lastLockedTargetRef.current.copy(targetPos)
      
      // Compute the desired camera position.
      const desiredCamPos = targetPos.clone().add(offset)
      camera.position.lerp(desiredCamPos, 0.1)
      
      // Adjust the look‑at target by lowering the Y value.
      const adjustedLookAt = targetPos.clone()
      adjustedLookAt.y += 4.5  // Lower the focus point by 1.5 units (adjust this value as needed)
      camera.lookAt(adjustedLookAt)
    }
  })

  return null
}
