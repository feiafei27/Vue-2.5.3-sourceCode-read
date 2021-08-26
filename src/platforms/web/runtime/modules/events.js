/* @flow */

import { isDef, isUndef } from 'shared/util'
import { updateListeners } from 'core/vdom/helpers/index'
import { withMacroTask, isIE, supportsPassive } from 'core/util/index'
import { RANGE_TOKEN, CHECKBOX_RADIO_TOKEN } from 'web/compiler/directives/model'

// normalize v-model event tokens that can only be determined at runtime.
// it's important to place the event as the first in the array because
// the whole point is ensuring the v-model callback gets called before
// user-attached handlers.
function normalizeEvents (on) {
  /* istanbul ignore if */
  if (isDef(on[RANGE_TOKEN])) {
    // IE input[type=range] only supports `change` event
    const event = isIE ? 'change' : 'input'
    on[event] = [].concat(on[RANGE_TOKEN], on[event] || [])
    delete on[RANGE_TOKEN]
  }
  // This was originally intended to fix #4521 but no longer necessary
  // after 2.5. Keeping it for backwards compat with generated code from < 2.4
  /* istanbul ignore if */
  if (isDef(on[CHECKBOX_RADIO_TOKEN])) {
    on.change = [].concat(on[CHECKBOX_RADIO_TOKEN], on.change || [])
    delete on[CHECKBOX_RADIO_TOKEN]
  }
}

let target: HTMLElement

// 实现事件修饰符 .once 的方法
function createOnceHandler (handler, event, capture) {
  const _target = target // save current target element in closure
  // 返回一个包装函数，当事件触发的时候，执行的就是这个返回的包装函数
  // 该包装函数执行时，内部会触发执行真正的回调函数，回调函数执行一次后，
  // 后续元素就不需要再绑定 event 事件了，所以执行 remove 方法解绑 event 事件
  return function onceHandler () {
    const res = handler.apply(null, arguments)
    if (res !== null) {
      // res !== null 的时候，才会执行 remove 方法，这主要是为了解决一个 bug，
      // issues 看这里：https://github.com/vuejs/vue/issues/4846
      remove(event, onceHandler, capture, _target)
    }
  }
}

// 绑定事件
function add (
  event: string,
  handler: Function,
  once: boolean,
  capture: boolean,
  passive: boolean
) {
  handler = withMacroTask(handler)
  // 如果事件绑定使用了 .once 的话，则给 handler 加一层包装
  if (once) handler = createOnceHandler(handler, event, capture)
  // 这里只是调用浏览器提供的 API --- node.addEventListener 绑定事件
  // target 就是使用了 v-on 指令的 DOM 元素
  target.addEventListener(
    event,
    handler,
    supportsPassive
      ? { capture, passive }
      : capture
  )
}

// 解绑事件
function remove (
  event: string,
  handler: Function,
  capture: boolean,
  _target?: HTMLElement
) {
  // 调用浏览器提供的 API --- node.removeEventListener 解绑事件
  (_target || target).removeEventListener(
    event,
    handler._withTask || handler,
    capture
  )
}

function updateDOMListeners (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  // 如果 oldVnode 和 vnode 中都没有事件对象的话，说明之前没有绑定任何事件，现在也没有新增绑定事件
  // 因此不需要做事件的绑定和解绑操作，直接 return 即可。
  if (isUndef(oldVnode.data.on) && isUndef(vnode.data.on)) {
    return
  }
  // 获取 vnode 和 oldVnode 中的事件对象
  const on = vnode.data.on || {}
  const oldOn = oldVnode.data.on || {}
  // vnode.elm 是 vnode 在页面上对应的真实 DOM 节点
  target = vnode.elm
  normalizeEvents(on)
  // 更新元素上的事件
  // 内部的机制是：对比 on 与 oldOn，然后根据对比的结果调用 add 方法或者 remove 方法执行绑定或解绑事件
  updateListeners(on, oldOn, add, remove, vnode.context)
}

export default {
  create: updateDOMListeners,
  update: updateDOMListeners
}
