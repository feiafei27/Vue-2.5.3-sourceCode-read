/* @flow */

import type Watcher from './watcher'
import config from '../config'
import { callHook, activateChildComponent } from '../instance/lifecycle'

import {
  warn,
  nextTick,
  devtools
} from '../util/index'

export const MAX_UPDATE_COUNT = 100

const queue: Array<Watcher> = []
const activatedChildren: Array<Component> = []
let has: { [key: number]: ?true } = {}
let circular: { [key: number]: number } = {}
let waiting = false
let flushing = false
let index = 0

/**
 * watcher 实例统一调度程序
 */

/**
 * 重置调度程序的状态（就是将上面的功能变量设为初始状态）
 */
function resetSchedulerState () {
  index = queue.length = activatedChildren.length = 0
  has = {}
  if (process.env.NODE_ENV !== 'production') {
    circular = {}
  }
  waiting = flushing = false
}

/**
 * 执行队列中 watcher 实例的 run 方法
 */
function flushSchedulerQueue () {
  flushing = true
  let watcher, id

  // 刷新前对队列排序。
  // 这可确保：
  //  1. 组件从父级更新到子级(因为父级组件总是在子组件之前创建）。
  //  2. 组件的自定义 watcher 在组件的渲染 watcher 之前运行（因为自定义 watcher 在渲染 watcher 之前创建）。
  //  3. 如果在父组件的渲染 watcher 运行期间，子组件被销毁，该子组件的 watcher 会被跳过。
  queue.sort((a, b) => a.id - b.id)

  // 不要使用变量固定缓存当前状态 watcher 队列的长度，，因为新的 watcher 有可能随时被 push 到队列中
  // 遍历触发执行队列中的 watcher 实例
  for (index = 0; index < queue.length; index++) {
    watcher = queue[index]
    id = watcher.id
    // 将 map 中，当前 watcher 的 id 置空
    has[id] = null
    // 核心：执行 watcher 实例的 run 方法
    watcher.run()
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1
      if (circular[id] > MAX_UPDATE_COUNT) {
        warn(
          'You may have an infinite update loop ' + (
            watcher.user
              ? `in watcher with expression "${watcher.expression}"`
              : `in a component render function.`
          ),
          watcher.vm
        )
        break
      }
    }
  }

  // keep copies of post queues before resetting state
  const activatedQueue = activatedChildren.slice()
  const updatedQueue = queue.slice()

  // 重置调度程序的状态
  resetSchedulerState()

  // call component updated and activated hooks
  callActivatedHooks(activatedQueue)
  callUpdatedHooks(updatedQueue)

  // devtool hook
  /* istanbul ignore if */
  if (devtools && config.devtools) {
    devtools.emit('flush')
  }
}

function callUpdatedHooks (queue) {
  let i = queue.length
  while (i--) {
    const watcher = queue[i]
    const vm = watcher.vm
    if (vm._watcher === watcher && vm._isMounted) {
      callHook(vm, 'updated')
    }
  }
}

/**
 * Queue a kept-alive component that was activated during patch.
 * The queue will be processed after the entire tree has been patched.
 */
export function queueActivatedComponent (vm: Component) {
  // setting _inactive to false here so that a render function can
  // rely on checking whether it's in an inactive tree (e.g. router-view)
  vm._inactive = false
  activatedChildren.push(vm)
}

function callActivatedHooks (queue) {
  for (let i = 0; i < queue.length; i++) {
    queue[i]._inactive = true
    activateChildComponent(queue[i], true /* true */)
  }
}

/**
 * 添加一个 watcher 实例到 watcher 队列中
 * 如果某一个 watcher 已经被保存到队列中的话，将不会再进行 push 操作。（一个渲染 watcher 有可能监控
 * 多个数据，每个数据的改变都会使代码执行到这里，但其实只需要保存一次该渲染 watcher 即可）
 */
/**
 * 该函数借助 flushing 和 waiting 变量实现流程的控制
 */
export function queueWatcher (watcher: Watcher) {
  // 根据 watcher 的 id 判断这个 watcher 实例有没有保存到队列中，只有没有被缓存的 watcher 实例才会进行接下来的操作
  const id = watcher.id
  if (has[id] == null) {
    has[id] = true
    // 如果当前的队列不是刷新状态的话
    if (!flushing) {
      // 直接将 watcher push 到队列中即可
      queue.push(watcher)
    } else {
      // 如果当前正在进行刷新 watcher 队列，此时需要将当前的 watcher 插入到队列中合适的位置（按照 watcher 的 id 从小到大排列）
      let i = queue.length - 1
      while (i > index && queue[i].id > watcher.id) {
        i--
      }
      queue.splice(i + 1, 0, watcher)
    }
    // 如果当前不是等待状态的话，将 waiting 设为 true，在下一个 tick 执行清空并更新 watcher 的操作
    // 借助 waiting 变量控制 watcher 队列的清空执行，在同一时刻，只能有一个 flushSchedulerQueue 正在等待（下一个 tick）执行或者正在执行
    // 只有当前时刻，没有 flushSchedulerQueue 正在等待执行或者正在执行，才会执行 nextTick(flushSchedulerQueue)
    if (!waiting) {
      waiting = true
      nextTick(flushSchedulerQueue)
    }
  }
}
