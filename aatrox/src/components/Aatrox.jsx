// components/Aatrox.jsx
import React, { useRef, useImperativeHandle, forwardRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  useRecallAnimation,
  useMovementAnimations,
  useDashAnimation,
  useCombatFlow,
} from '../hooks/useAatroxAnimations'

function AatroxComponent(props, ref) {
  const group = useRef()
  // Expose the group to parent via ref.
  useImperativeHandle(ref, () => group.current)

  const { nodes, materials, animations } = useGLTF('/models/Aatrox.glb')
  const { actions, mixer } = useAnimations(animations, group)

  // (Your state refs and custom hooks remain unchanged.)
  const recallPlayed = useRef(false)
  const readyForCommands = useRef(false)
  const movementState = useRef('idle')
  const targetPosition = useRef(null)
  const qCycleRef = useRef(0)
  const currentQActionRef = useRef(null)
  const currentIntoIdleActionRef = useRef(null)

  useRecallAnimation(props, actions, mixer, recallPlayed, readyForCommands)
  useMovementAnimations(props, actions, mixer, group, movementState, targetPosition, qCycleRef)
  useDashAnimation(actions, mixer, movementState, group, targetPosition) 
  useCombatFlow(
    actions,
    mixer,
    movementState,
    qCycleRef,
    currentQActionRef,
    currentIntoIdleActionRef,
    targetPosition,
    props.onQCycleChange
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

export const Aatrox = forwardRef(AatroxComponent)

useGLTF.preload('/models/Aatrox.glb')
