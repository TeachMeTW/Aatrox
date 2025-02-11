import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * Plays the recall animation on mount and then transitions to idle.
 */
export function useRecallAnimation(props, actions, mixer, recallPlayed, readyForCommands) {
  // Hard-coded global speed multiplier.
  const globalSpeed = 0.5

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
      // Set the recall animation speed using the global multiplier.
      recallAction.timeScale = 1.0 * globalSpeed
      recallAction.play()
      console.log('Playing recall animation')

      const handleRecallFinished = (event) => {
        if (event.action === recallAction) {
          console.log('Recall finished')
          mixer.removeEventListener('finished', handleRecallFinished)
          idleAction.reset()
          idleAction.setLoop(THREE.LoopRepeat, Infinity)
          idleAction.fadeIn(0.3)
          idleAction.timeScale = 1.0 * globalSpeed
          idleAction.play()
          readyForCommands.current = true
          if (props.onRecallComplete) props.onRecallComplete()
        }
      }
      mixer.addEventListener('finished', handleRecallFinished)
    }
  }, [actions, mixer, props, recallPlayed, readyForCommands, globalSpeed])
}

/**
 * Handles right‑click destination updates and movement (unsheath/run/resume).
 */
export function useMovementAnimations(props, actions, mixer, group, movementState, targetPosition, qCycleRef) {
  // Hard-coded global speed multiplier.
  const globalSpeed = 0.5

  useEffect(() => {
    if (!props.destination || !group.current) return

    // Allowed states: idle, running, idle_in_sheath, q, q_hold, resuming.
    const allowedStates = ['idle', 'running', 'idle_in_sheath', 'q', 'q_hold', 'resuming']
    if (!allowedStates.includes(movementState.current)) {
      console.log('Ignoring destination update because movementState is:', movementState.current)
      return
    }

    // If in a Q chain, cancel it and advance the Q cycle.
    if (movementState.current === 'q' || movementState.current === 'q_hold') {
      console.log('Cancelling Q chain due to destination update; advancing Q cycle')
      qCycleRef.current = (qCycleRef.current % 3) + 1
      movementState.current = 'resuming'
    }

    // Update destination.
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

    // If resuming, immediately resume run animation without unsheath.
    if (movementState.current === 'resuming') {
      if (actions['aatrox_unsheath_run01.anm']) {
        const runAction = actions['aatrox_unsheath_run01.anm']
        runAction.reset()
        runAction.setLoop(THREE.LoopRepeat, Infinity)
        runAction.fadeIn(0.3)
        runAction.timeScale = 1.0 * globalSpeed
        runAction.play()
        movementState.current = 'running'
      } else {
        movementState.current = 'idle'
      }
      return
    }

    // Otherwise, if idle, start unsheath → run.
    if (movementState.current === 'idle') {
      if (actions['aatrox_idle1.anm']) actions['aatrox_idle1.anm'].fadeOut(0.2)
      if (actions['aatrox_unsheath.anm'] && actions['aatrox_unsheath_run01.anm']) {
        const unsheathAction = actions['aatrox_unsheath.anm']
        const runAction = actions['aatrox_unsheath_run01.anm']
        unsheathAction.stop()
        runAction.stop()
        unsheathAction.reset()
        unsheathAction.clampWhenFinished = true
        unsheathAction.setLoop(THREE.LoopOnce, 0)
        unsheathAction.fadeIn(0.3)
        unsheathAction.timeScale = 1.0 * globalSpeed
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
            runAction.timeScale = 1.0 * globalSpeed
            runAction.play()
            movementState.current = 'running'
          }
        }
        mixer.addEventListener('finished', handleUnsheathFinished)
      }
    }
  }, [props.destination, actions, mixer, group, movementState, targetPosition, qCycleRef, globalSpeed])

  useFrame((state, delta) => {
    // Update the mixer each frame with global speed.
    mixer.timeScale = globalSpeed
    mixer.update(delta)

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
          resheathAction.timeScale = 1.0 * globalSpeed
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
                idleInSheathAction.timeScale = 1.0 * globalSpeed
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
                      idleAction.timeScale = 1.0 * globalSpeed
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
                  idleAction.timeScale = 1.0 * globalSpeed
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
        const moveSpeed = 5 // physical movement speed
        pos.addScaledVector(dir, moveSpeed * delta)
      }
    }
  })
}


/**
 * Handles combined combat flow for Q and W keys.
 */
export function useCombatFlow(
    actions,
    mixer,
    movementState,
    qCycleRef,
    currentQActionRef,
    currentIntoIdleActionRef,
    targetPosition
  ) {
    // Hard-coded global speed multiplier.
    const globalSpeed = 0.5
  
    useEffect(() => {
      const triggerResheath = () => {
        if (actions['aatrox_resheath_fullbody.anm']) {
          const resheathAction = actions['aatrox_resheath_fullbody.anm']
          resheathAction.reset()
          resheathAction.setLoop(THREE.LoopOnce, 0)
          resheathAction.fadeIn(0.2)
          resheathAction.timeScale = 1.0 * globalSpeed
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
                idleAction.timeScale = 1.0 * globalSpeed
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
            idleAction.timeScale = 1.0 * globalSpeed
            idleAction.play()
          }
          movementState.current = 'idle'
          qCycleRef.current = 1
        }
      }
  
      const handleKeyDown = (event) => {
        const key = event.key.toLowerCase()
        if (key !== 'q' && key !== 'w') return
  
        // *** INTERRUPT ANY CURRENT SPELL ***
        if (movementState.current === 'spell') {
          console.log("Interrupting current spell to process new input:", key)
          if (actions['aatrox_spell3.anm']) {
            actions['aatrox_spell3.anm'].stop()
          }
          if (actions['aatrox_spell3_unsheath.anm']) {
            actions['aatrox_spell3_unsheath.anm'].stop()
          }
          if (actions['aatrox_spell3_unsheath_to_idle.anm']) {
            actions['aatrox_spell3_unsheath_to_idle.anm'].stop()
          }
          movementState.current = 'idle'
        }
        // ---------------------------------------
  
        // Save the previous movement state so we can resume afterward.
        const prevState = movementState.current
  
        if (key === 'q') {
          // Allow Q if state is 'idle', 'running', 'q', or 'q_hold'
          if (!['idle', 'running', 'q', 'q_hold'].includes(movementState.current)) {
            console.log('Q ignored because movementState is:', movementState.current)
            return
          }
          console.log('Q pressed')
          // If in running, cancel movement.
          if (movementState.current === 'running') {
            if (actions['aatrox_unsheath_run01.anm']) {
              actions['aatrox_unsheath_run01.anm'].stop()
            }
            targetPosition.current = null
            console.log('Movement cancelled due to Q press')
          }
          // Cancel any previous Q actions.
          if (currentQActionRef.current) {
            currentQActionRef.current.stop()
            currentQActionRef.current = null
          }
          if (currentIntoIdleActionRef.current) {
            currentIntoIdleActionRef.current.stop()
            currentIntoIdleActionRef.current = null
          }
          // *** ALWAYS increment the Q cycle on Q press ***
          qCycleRef.current = (qCycleRef.current % 3) + 1
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
          currentQActionRef.current = groundAction
          currentIntoIdleActionRef.current = intoIdleAction
          if (actions['aatrox_idle1.anm']) {
            actions['aatrox_idle1.anm'].stop()
          }
          groundAction.clampWhenFinished = true
          groundAction.reset()
          groundAction.setLoop(THREE.LoopOnce, 0)
          groundAction.fadeIn(0.2)
          groundAction.timeScale = 1.0 * globalSpeed
          groundAction.play()
          console.log(`Playing ${groundActionName} (combo ${qIndex})`)
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
              intoIdleAction.timeScale = 1.0 * globalSpeed
              intoIdleAction.play()
              console.log(`Playing ${intoIdleName}`)
              const onIntoIdleFinished = (event2) => {
                if (event2.action === intoIdleAction) {
                  console.log(`${intoIdleName} finished`)
                  mixer.removeEventListener('finished', onIntoIdleFinished)
                  intoIdleAction.stop()
                  currentIntoIdleActionRef.current = null
                  // Immediately trigger resheath.
                  triggerResheath()
                }
              }
              mixer.addEventListener('finished', onIntoIdleFinished)
            }
          }
          mixer.addEventListener('finished', onGroundAttackFinished)
        } else if (key === 'w') {
          // Allow W if state is 'idle', 'running', 'q', or 'q_hold'
          if (!['idle', 'running', 'q', 'q_hold'].includes(movementState.current)) {
            console.log('W ignored because movementState is:', movementState.current)
            return
          }
          console.log('W pressed for Spell3')
          // Cancel any active Q actions.
          if (currentQActionRef.current) {
            currentQActionRef.current.stop()
            currentQActionRef.current = null
          }
          if (currentIntoIdleActionRef.current) {
            currentIntoIdleActionRef.current.stop()
            currentIntoIdleActionRef.current = null
          }
          movementState.current = 'spell'
          if (prevState === 'running') {
            if (actions['aatrox_spell3_unsheath.anm']) {
              const spellUnsheath = actions['aatrox_spell3_unsheath.anm']
              // Multiply local speed (1) by global speed.
              spellUnsheath.timeScale = 1 * globalSpeed
              spellUnsheath.reset()
              spellUnsheath.setLoop(THREE.LoopOnce, 0)
              spellUnsheath.fadeIn(0.2)
              spellUnsheath.play()
              console.log('Playing aatrox_spell3_unsheath.anm at 0.45 speed')
              const onSpellUnsheathFinished = (e) => {
                if (e.action === spellUnsheath) {
                  console.log('Spell3 unsheath finished')
                  mixer.removeEventListener('finished', onSpellUnsheathFinished)
                  spellUnsheath.stop()
                  // Resume run animation and physical movement.
                  if (actions['aatrox_unsheath_run01.anm']) {
                    const runAction = actions['aatrox_unsheath_run01.anm']
                    runAction.reset()
                    runAction.setLoop(THREE.LoopRepeat, Infinity)
                    runAction.fadeIn(0.2)
                    runAction.timeScale = 1.0 * globalSpeed
                    runAction.play()
                    movementState.current = 'running'
                  } else {
                    movementState.current = 'idle'
                  }
                }
              }
              mixer.addEventListener('finished', onSpellUnsheathFinished)
            }
          } else {
            // If sheathed (idle), play aatrox_spell3.anm.
            if (actions['aatrox_spell3.anm']) {
              const spell3 = actions['aatrox_spell3.anm']
              // Multiply local speed (0.55) by global speed.
              spell3.timeScale = 0.55 * globalSpeed
              spell3.reset()
              spell3.setLoop(THREE.LoopOnce, 0)
              spell3.fadeIn(0.2)
              spell3.play()
              console.log('Playing aatrox_spell3.anm at 0.45 speed')
              const onSpell3Finished = (e) => {
                if (e.action === spell3) {
                  console.log('Spell3 finished')
                  mixer.removeEventListener('finished', onSpell3Finished)
                  spell3.stop()
                  // Resume idle.
                  if (actions['aatrox_idle1.anm']) {
                    const idleAction = actions['aatrox_idle1.anm']
                    idleAction.reset()
                    idleAction.setLoop(THREE.LoopRepeat, Infinity)
                    idleAction.fadeIn(0.2)
                    idleAction.timeScale = 1.0 * globalSpeed
                    idleAction.play()
                  }
                  movementState.current = 'idle'
                }
              }
              mixer.addEventListener('finished', onSpell3Finished)
            }
          }
        }
      }
  
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [actions, mixer, movementState, qCycleRef, currentQActionRef, currentIntoIdleActionRef, targetPosition, globalSpeed])
  }
  

/**
 * Handles the dash animation and transition back to running or idle.
 */
export function useDashAnimation(actions, mixer, movementState, group, targetPosition) {
    // Hard-coded global speed multiplier.
    const globalSpeed = 0.5
  
    const dashDurationRef = useRef(0)           // dash duration in seconds
    const dashDirectionRef = useRef(new THREE.Vector3())
    const isDashing = useRef(false)
    const dashPrevState = useRef(null)            // to store previous state (idle or running)
    const mouseRef = useRef(new THREE.Vector2())
    const { camera, gl } = useThree()
  
    // Update mouse coordinates.
    useEffect(() => {
      const handleMouseMove = (event) => {
        const rect = gl.domElement.getBoundingClientRect()
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
      }
      window.addEventListener('mousemove', handleMouseMove)
      return () => window.removeEventListener('mousemove', handleMouseMove)
    }, [gl])
  
    // Listen for E key press.
    useEffect(() => {
      const handleKeyDown = (event) => {
        if (event.key.toLowerCase() !== 'e') return
  
        // If state is idle or running, play dash as normal.
        if (['idle', 'running'].includes(movementState.current)) {
          console.log('E pressed for dash in idle/running state')
          dashPrevState.current = movementState.current
  
          const raycaster = new THREE.Raycaster()
          raycaster.setFromCamera(mouseRef.current, camera)
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
          const intersection = new THREE.Vector3()
          raycaster.ray.intersectPlane(groundPlane, intersection)
          if (!intersection) {
            console.log('No intersection found for dash')
            return
          }
          const currentPos = group.current.position
          dashDirectionRef.current.subVectors(intersection, currentPos).normalize()
          console.log('Dash direction:', dashDirectionRef.current)
  
          isDashing.current = true
          dashDurationRef.current = 0.3  // Dash lasts 0.3 seconds
  
          if (actions['aatrox_spell3_dash.anm']) {
            const dashAction = actions['aatrox_spell3_dash.anm']
            dashAction.reset()
            dashAction.setLoop(THREE.LoopOnce, 0)
            dashAction.timeScale = 1 * globalSpeed
            dashAction.fadeIn(0.2)
            dashAction.play()
            console.log('Playing aatrox_spell3_dash.anm')
          }
        }
        // If state is in a combat state (q, q_hold, or spell), then update direction and set a target.
        else if (['q', 'q_hold', 'spell'].includes(movementState.current)) {
          console.log('E pressed in combat state; updating direction and setting gradual move target')
          const raycaster = new THREE.Raycaster()
          raycaster.setFromCamera(mouseRef.current, camera)
          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
          const intersection = new THREE.Vector3()
          raycaster.ray.intersectPlane(groundPlane, intersection)
          if (!intersection) {
            console.log('No intersection found for turning/movement')
            return
          }
          const currentPos = group.current.position
          // Calculate the new direction vector.
          const newDir = new THREE.Vector3().subVectors(intersection, currentPos).normalize()
          // Update the character’s rotation immediately.
          group.current.rotation.y = Math.atan2(newDir.x, newDir.z)
          // Compute a target position by moving a fixed distance along newDir.
          const moveDistance = 5  // total distance to cover
          const targetPos = new THREE.Vector3().copy(currentPos).addScaledVector(newDir, moveDistance)
          // Store the target position in the passed ref so that the useFrame loop will move gradually.
          targetPosition.current = targetPos
          console.log('Set new gradual movement target:', targetPos)
          return
        } else {
          console.log('E ignored because movementState is:', movementState.current)
          return
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }, [actions, camera, gl, movementState, group, globalSpeed, targetPosition])
  
    useFrame((state, delta) => {
      // Update the mixer each frame with global speed.
      mixer.timeScale = globalSpeed
      mixer.update(delta)
  
      // If we are in dash mode, process dash movement.
      if (isDashing.current && group.current) {
        dashDurationRef.current -= delta
        // Move the character along the dash direction.
        group.current.position.addScaledVector(dashDirectionRef.current, 20 * delta)
        // Rotate the character to face the dash direction.
        group.current.rotation.y = Math.atan2(dashDirectionRef.current.x, dashDirectionRef.current.z)
        if (dashDurationRef.current <= 0) {
          isDashing.current = false
          console.log('Dash finished')
          if (dashPrevState.current === 'running' && actions['aatrox_spell3_dash_to_walk.anm']) {
            const dashToWalk = actions['aatrox_spell3_dash_to_walk.anm']
            dashToWalk.reset()
            dashToWalk.setLoop(THREE.LoopOnce, 0)
            dashToWalk.timeScale = 0.45 * globalSpeed
            dashToWalk.fadeIn(0.1)
            dashToWalk.play()
            console.log('Playing aatrox_spell3_dash_to_walk.anm')
            if (actions['aatrox_unsheath_run01.anm']) {
              const runAction = actions['aatrox_unsheath_run01.anm']
              runAction.reset()
              runAction.setLoop(THREE.LoopRepeat, Infinity)
              runAction.fadeIn(0.1)
              runAction.timeScale = 1.0 * globalSpeed
              runAction.play()
              runAction.crossFadeFrom(dashToWalk, 0.1, false)
              movementState.current = 'running'
            }
          } else {
            if (dashPrevState.current === 'running' && actions['aatrox_unsheath_run01.anm']) {
              const runAction = actions['aatrox_unsheath_run01.anm']
              runAction.reset()
              runAction.setLoop(THREE.LoopRepeat, Infinity)
              runAction.fadeIn(0.2)
              runAction.timeScale = 1.0 * globalSpeed
              runAction.play()
              movementState.current = 'running'
            } else if (dashPrevState.current === 'idle' && actions['aatrox_idle1.anm']) {
              const idleAction = actions['aatrox_idle1.anm']
              idleAction.reset()
              idleAction.setLoop(THREE.LoopRepeat, Infinity)
              idleAction.fadeIn(0.2)
              idleAction.timeScale = 1.0 * globalSpeed
              idleAction.play()
              movementState.current = 'idle'
            }
          }
        }
      }
      // Gradually move toward the target position if one is set (for combat state turns).
      if (!isDashing.current && targetPosition && targetPosition.current && group.current) {
        const currentPos = group.current.position
        const targetPos = targetPosition.current
        const distance = currentPos.distanceTo(targetPos)
        const moveSpeed = 10  // units per second (adjust as needed)
        const step = moveSpeed * delta
        if (distance > step) {
          // Lerp a fraction of the distance.
          currentPos.lerp(targetPos, step / distance)
        } else {
          // Close enough—snap to target and clear it.
          currentPos.copy(targetPos)
          targetPosition.current = null
        }
      }
    })
  }
  