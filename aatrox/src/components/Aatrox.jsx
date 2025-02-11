import React, { useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  useRecallAnimation,
  useMovementAnimations,
  useDashAnimation,
  useCombatFlow,
} from '../hooks/useAatroxAnimations'

export function Aatrox(props) {
  const group = useRef()
  const { nodes, materials, animations } = useGLTF('/models/Aatrox.glb')
  const { actions, mixer } = useAnimations(animations, group)

  // State refs.
  const recallPlayed = useRef(false)
  const readyForCommands = useRef(false)
  const movementState = useRef('idle')
  const targetPosition = useRef(null)
  const qCycleRef = useRef(0)
  const currentQActionRef = useRef(null)
  const currentIntoIdleActionRef = useRef(null)

  // Use custom hooks.
  useRecallAnimation(props, actions, mixer, recallPlayed, readyForCommands)
  useMovementAnimations(props, actions, mixer, group, movementState, targetPosition, qCycleRef)
  //useQAnimations(actions, mixer, movementState, qCycleRef, currentQActionRef, currentIntoIdleActionRef, targetPosition)
  useDashAnimation(actions, mixer, movementState, group, targetPosition) 
  useCombatFlow(
    actions,
    mixer,
    movementState,
    qCycleRef,
    currentQActionRef,
    currentIntoIdleActionRef,
    targetPosition
  )

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="SkinnedMesh">
        <group name="skinned_mesh">
          <skinnedMesh name="mesh_0" geometry={nodes.mesh_0.geometry} material={materials.Wings} skeleton={nodes.mesh_0.skeleton} />
          <skinnedMesh name="mesh_0_1" geometry={nodes.mesh_0_1.geometry} material={materials.Body} skeleton={nodes.mesh_0_1.skeleton} />
          <skinnedMesh name="mesh_0_2" geometry={nodes.mesh_0_2.geometry} material={materials.Sword} skeleton={nodes.mesh_0_2.skeleton} />
          <primitive object={nodes.Root} />
          <primitive object={nodes.Weapon_World} />
          <primitive object={nodes.Buffbone_Glb_Channel_Loc} />
          <primitive object={nodes.Buffbone_Glb_Ground_Loc} />
          <primitive object={nodes.C_Buffbone_Glb_Layout_Loc} />
          <primitive object={nodes.C_Buffbone_Glb_Overhead_Loc} />
          <primitive object={nodes.RunPython} />
          <primitive object={nodes.Buffbone_Cstm_Healthbar} />
          <primitive object={nodes.Body_World} />
        </group>
      </group>
    </group>
  )
}

useGLTF.preload('/models/Aatrox.glb')
