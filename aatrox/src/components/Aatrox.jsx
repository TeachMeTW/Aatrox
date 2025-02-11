// src/components/Aatrox.jsx
import React, { useEffect, useRef } from 'react'
import { useGLTF, useAnimations } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Aatrox(props) {
  const group = useRef()
  // Ensure recall is played only once.
  const recallPlayed = useRef(false)
  // Track when we’re ready for new right‑click commands.
  const readyForCommands = useRef(false)
  /*  
    Movement states:
      'idle' – normal idle.
      'starting' – beginning unsheath/run.
      'running' – moving.
      'resheathing' – finishing movement.
      'idle_in_sheath' – idle after resheath.
      'q' – playing a ground attack sequence.
      'q_hold' – finished the ground-into-idle and holding a frozen pose.
      'resuming' – resuming movement from a Q chain cancellation.
  */
  const movementState = useRef('idle')
  const targetPosition = useRef(null)
  // Track the current Q cycle (1, 2, or 3).
  const qCycleRef = useRef(1)
  // --- New refs for chaining Q animations ---
  const currentQActionRef = useRef(null)
  const currentIntoIdleActionRef = useRef(null)

  const { nodes, materials, animations } = useGLTF('/models/Aatrox.glb')
  const { actions, mixer } = useAnimations(animations, group)

  // Debug: log available animations.
  useEffect(() => {
    console.log('Available animations:', Object.keys(actions || {}))
  }, [actions])

  // 1. On mount: play recall then transition to idle.
  useEffect(() => {
    if (recallPlayed.current) return

    if (
      actions &&
      mixer &&
      actions['aatrox_recall_winddown.anm'] &&
      actions['aatrox_idle1.anm']
    ) {
      recallPlayed.current = true
      const recallAction = actions['aatrox_recall_winddown.anm']
      const idleAction = actions['aatrox_idle1.anm']

      recallAction.reset()
      recallAction.setLoop(THREE.LoopOnce, 0)
      recallAction.fadeIn(0.2)
      recallAction.play()
      console.log('Playing recall animation')

      const handleRecallFinished = (event) => {
        if (event.action === recallAction) {
          console.log('Recall finished')
          mixer.removeEventListener('finished', handleRecallFinished)
          idleAction.reset()
          idleAction.setLoop(THREE.LoopRepeat, Infinity)
          idleAction.fadeIn(0.3)
          idleAction.play()
          readyForCommands.current = true
          if (props.onRecallComplete) {
            props.onRecallComplete()
          }
        }
      }
      mixer.addEventListener('finished', handleRecallFinished)
    }
  }, [actions, mixer, props.onRecallComplete])

  // 2. Right‑click destination (movement)
  useEffect(() => {
    if (!props.destination || !group.current) return

    // Allow destination updates if state is one of these:
    // 'idle', 'running', 'idle_in_sheath', 'q', 'q_hold', or 'resuming'
    if (
      !readyForCommands.current ||
      (movementState.current !== 'idle' &&
       movementState.current !== 'running' &&
       movementState.current !== 'idle_in_sheath' &&
       movementState.current !== 'q' &&
       movementState.current !== 'q_hold' &&
       movementState.current !== 'resuming')
    ) {
      console.log('Ignoring destination update because movementState is:', movementState.current)
      return
    }

    // If in a Q chain, cancel the Q sequence and advance the Q cycle.
    if (movementState.current === 'q' || movementState.current === 'q_hold') {
      if (currentQActionRef.current) {
        currentQActionRef.current.stop()
        currentQActionRef.current = null
      }
      if (currentIntoIdleActionRef.current) {
        currentIntoIdleActionRef.current.stop()
        currentIntoIdleActionRef.current = null
      }
      // Advance Q cycle so that the next Q will be different.
      qCycleRef.current = (qCycleRef.current % 3) + 1
      console.log('Cancelling Q chain due to destination update; advancing Q cycle to', qCycleRef.current)
      // Set a state indicating we want to resume movement.
      movementState.current = 'resuming'
    }

    // Update the destination.
    const destVec = new THREE.Vector3(...props.destination)
    targetPosition.current = destVec.clone()

    const currentPos = group.current.position
    const direction = new THREE.Vector3().subVectors(destVec, currentPos)
    const angle = Math.atan2(direction.x, direction.z)
    group.current.rotation.y = angle

    // If already running, update target and return.
    if (movementState.current === 'running') {
      console.log('Already running, updated target only.')
      return
    }

    // If state is 'resuming', simply start the run animation without unsheath.
    if (movementState.current === 'resuming') {
      if (actions['aatrox_unsheath_run01.anm']) {
        const runAction = actions['aatrox_unsheath_run01.anm']
        runAction.reset()
        runAction.setLoop(THREE.LoopRepeat, Infinity)
        runAction.fadeIn(0.3)
        runAction.play()
        movementState.current = 'running'
      } else {
        movementState.current = 'idle'
      }
      return
    }

    // Otherwise, if state is idle, start unsheath → run.
    if (movementState.current === 'idle') {
      if (actions['aatrox_idle1.anm']) {
        actions['aatrox_idle1.anm'].fadeOut(0.2)
      }
      if (actions['aatrox_unsheath.anm'] && actions['aatrox_unsheath_run01.anm']) {
        const unsheathAction = actions['aatrox_unsheath.anm']
        const runAction = actions['aatrox_unsheath_run01.anm']

        unsheathAction.stop()
        runAction.stop()

        unsheathAction.reset()
        unsheathAction.clampWhenFinished = true
        unsheathAction.setLoop(THREE.LoopOnce, 0)
        unsheathAction.fadeIn(0.3)
        unsheathAction.play()
        movementState.current = 'starting'
        console.log('Playing unsheath animation')

        const handleUnsheathFinished = (event) => {
          if (event.action === unsheathAction) {
            console.log('Unsheath finished')
            mixer.removeEventListener('finished', handleUnsheathFinished)
            unsheathAction.stop()
            runAction.reset()
            runAction.stop()
            runAction.setLoop(THREE.LoopRepeat, Infinity)
            runAction.fadeIn(0.3)
            runAction.play()
            movementState.current = 'running'
          }
        }
        mixer.addEventListener('finished', handleUnsheathFinished)
      }
    }
  }, [props.destination, actions, mixer])

  // 3. useFrame: move while running; on arrival, trigger resheath → idle_in_sheath → idle.
  useFrame((state, delta) => {
    if (
      movementState.current === 'running' &&
      targetPosition.current &&
      group.current
    ) {
      const pos = group.current.position
      const target = targetPosition.current
      const dir = new THREE.Vector3().subVectors(target, pos)
      const distance = dir.length()

      if (distance < 0.1) {
        console.log('Arrived at destination')
        const runAction = actions['aatrox_unsheath_run01.anm']
        if (runAction) runAction.fadeOut(0.2)
        if (actions['aatrox_resheath_fullbody.anm']) {
          const resheathAction = actions['aatrox_resheath_fullbody.anm']
          resheathAction.reset()
          resheathAction.setLoop(THREE.LoopOnce, 0)
          resheathAction.play()
          movementState.current = 'resheathing'
          console.log('Playing resheath animation')

          const handleResheathFinished = (event) => {
            if (event.action === resheathAction) {
              console.log('Resheath finished')
              mixer.removeEventListener('finished', handleResheathFinished)
              resheathAction.stop()
              if (actions['aatrox_idle_in_sheath.anm']) {
                const idleInSheathAction = actions['aatrox_idle_in_sheath.anm']
                idleInSheathAction.reset()
                idleInSheathAction.setLoop(THREE.LoopOnce, 0)
                idleInSheathAction.play()
                console.log('Playing idle_in_sheath animation')
                const handleIdleInSheathFinished = (event2) => {
                  if (event2.action === idleInSheathAction) {
                    console.log('Idle_in_sheath finished')
                    mixer.removeEventListener('finished', handleIdleInSheathFinished)
                    if (actions['aatrox_idle1.anm']) {
                      const idleAction = actions['aatrox_idle1.anm']
                      idleAction.reset()
                      idleAction.setLoop(THREE.LoopRepeat, Infinity)
                      idleAction.play()
                    }
                    movementState.current = 'idle'
                    targetPosition.current = null
                  }
                }
                mixer.addEventListener('finished', handleIdleInSheathFinished)
                movementState.current = 'idle_in_sheath'
              } else {
                if (actions['aatrox_idle1.anm']) {
                  const idleAction = actions['aatrox_idle1.anm']
                  idleAction.reset()
                  idleAction.setLoop(THREE.LoopRepeat, Infinity)
                  idleAction.play()
                }
                movementState.current = 'idle'
                targetPosition.current = null
              }
            }
          }
          mixer.addEventListener('finished', handleResheathFinished)
        }
      } else {
        dir.normalize()
        const speed = 10
        pos.addScaledVector(dir, speed * delta)
      }
    }
  })

  // 4. Q Key Handler: trigger ground attack sequences.
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key.toLowerCase() !== 'q') return

      // Allow Q if state is 'idle', 'running', 'q', or 'q_hold'
      if (!['idle', 'running', 'q', 'q_hold'].includes(movementState.current)) {
        console.log('Q ignored because movementState is:', movementState.current)
        return
      }
      console.log('Q pressed')

      // If in 'running', cancel movement (so that Q can override movement).
      if (movementState.current === 'running') {
        if (actions['aatrox_unsheath_run01.anm']) {
          actions['aatrox_unsheath_run01.anm'].stop()
        }
        targetPosition.current = null
        console.log('Movement cancelled due to Q press')
      }

      // If a previous Q ground action is still playing, stop it.
      if (currentQActionRef.current) {
        currentQActionRef.current.stop()
        currentQActionRef.current = null
      }
      if (currentIntoIdleActionRef.current) {
        currentIntoIdleActionRef.current.stop()
        currentIntoIdleActionRef.current = null
      }

      // Advance the Q cycle if already in a Q sequence.
      if (movementState.current === 'q' || movementState.current === 'q_hold') {
        qCycleRef.current = (qCycleRef.current % 3) + 1
      }
      movementState.current = 'q'
      const qIndex = qCycleRef.current
      let groundActionName, intoIdleName
      if (qIndex === 1) {
        groundActionName = 'aatrox_ground_q1.anm'
        intoIdleName = 'aatrox_ground_q1_into_idle.anm'
      } else if (qIndex === 2) {
        groundActionName = 'aatrox_ground_q2.anm'
        intoIdleName = 'aatrox_ground_q2_to_idle.anm'
      } else if (qIndex === 3) {
        groundActionName = 'aatrox_ground_q3.anm'
        intoIdleName = 'aatrox_ground_q3_into_idle1.anm'
      }
      if (!actions[groundActionName] || !actions[intoIdleName]) {
        console.log('Missing ground Q animations for index', qIndex)
        movementState.current = 'idle'
        return
      }
      const groundAction = actions[groundActionName]
      const intoIdleAction = actions[intoIdleName]

      // Store current Q actions so they can be interrupted.
      currentQActionRef.current = groundAction
      currentIntoIdleActionRef.current = intoIdleAction

      if (actions['aatrox_idle1.anm']) {
        actions['aatrox_idle1.anm'].stop()
      }

      groundAction.clampWhenFinished = true
      groundAction.reset()
      groundAction.setLoop(THREE.LoopOnce, 0)
      groundAction.fadeIn(0.2)
      groundAction.play()
      console.log(`Playing ${groundActionName}`)

      const onGroundAttackFinished = (event) => {
        if (event.action === groundAction) {
          console.log(`${groundActionName} finished`)
          mixer.removeEventListener('finished', onGroundAttackFinished)
          groundAction.stop()
          // Now play the into-idle clip.
          intoIdleAction.clampWhenFinished = true
          intoIdleAction.reset()
          intoIdleAction.setLoop(THREE.LoopOnce, 0)
          intoIdleAction.fadeIn(0.2)
          intoIdleAction.play()
          console.log(`Playing ${intoIdleName}`)
          const onIntoIdleFinished = (event2) => {
            if (event2.action === intoIdleAction) {
              console.log(`${intoIdleName} finished`)
              mixer.removeEventListener('finished', onIntoIdleFinished)
              intoIdleAction.stop()
              currentIntoIdleActionRef.current = null
              // Immediately trigger resheath (like run/walk).
              triggerResheath()
            }
          }
          mixer.addEventListener('finished', onIntoIdleFinished)
        }
      }
      mixer.addEventListener('finished', onGroundAttackFinished)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [actions, mixer])

  // Helper: trigger resheath sequence and return to idle.
  const triggerResheath = () => {
    if (actions['aatrox_resheath_fullbody.anm']) {
      const resheathAction = actions['aatrox_resheath_fullbody.anm']
      resheathAction.reset()
      resheathAction.setLoop(THREE.LoopOnce, 0)
      resheathAction.fadeIn(0.2)
      resheathAction.play()
      console.log('Playing resheath')
      const onResheathFinished = (event) => {
        if (event.action === resheathAction) {
          console.log('Resheath finished')
          mixer.removeEventListener('finished', onResheathFinished)
          resheathAction.stop()
          if (actions['aatrox_idle1.anm']) {
            const idleAction = actions['aatrox_idle1.anm']
            idleAction.reset()
            idleAction.setLoop(THREE.LoopRepeat, Infinity)
            idleAction.fadeIn(0.2)
            idleAction.play()
          }
          movementState.current = 'idle'
          qCycleRef.current = 1
        }
      }
      mixer.addEventListener('finished', onResheathFinished)
    } else {
      if (actions['aatrox_idle1.anm']) {
        const idleAction = actions['aatrox_idle1.anm']
        idleAction.reset()
        idleAction.setLoop(THREE.LoopRepeat, Infinity)
        idleAction.fadeIn(0.2)
        idleAction.play()
      }
      movementState.current = 'idle'
      qCycleRef.current = 1
    }
  }

  return (
    <group ref={group} {...props} dispose={null}>
      <group name="SkinnedMesh">
        <group name="skinned_mesh">
          <skinnedMesh
            name="mesh_0"
            geometry={nodes.mesh_0.geometry}
            material={materials.Wings}
            skeleton={nodes.mesh_0.skeleton}
          />
          <skinnedMesh
            name="mesh_0_1"
            geometry={nodes.mesh_0_1.geometry}
            material={materials.Body}
            skeleton={nodes.mesh_0_1.skeleton}
          />
          <skinnedMesh
            name="mesh_0_2"
            geometry={nodes.mesh_0_2.geometry}
            material={materials.Sword}
            skeleton={nodes.mesh_0_2.skeleton}
          />
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
