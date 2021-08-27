/* @flow */

import {
  tip,
  toArray,
  hyphenate,
  handleError,
  formatComponentName
} from '../util/index'
import { updateListeners } from '../vdom/helpers/index'

export function initEvents (vm: Component) {
  vm._events = Object.create(null)
  vm._hasHookEvent = false
  // init parent attached events
  const listeners = vm.$options._parentListeners
  if (listeners) {
    updateComponentListeners(vm, listeners)
  }
}

let target: Component

function add (event, fn, once) {
  if (once) {
    target.$once(event, fn)
  } else {
    target.$on(event, fn)
  }
}

function remove (event, fn) {
  target.$off(event, fn)
}

export function updateComponentListeners (
  vm: Component,
  listeners: Object,
  oldListeners: ?Object
) {
  target = vm
  updateListeners(listeners, oldListeners || {}, add, remove, vm)
}

export function eventsMixin (Vue: Class<Component>) {
  const hookRE = /^hook:/
  Vue.prototype.$on = function (event: string | Array<string>, fn: Function): Component {
    const vm: Component = this
    // 判断注册的 event 是不是数组，如果是数组的话，则数组中的多个事件都需要注册 fn 函数
    if (Array.isArray(event)) {
      // 遍历事件数组
      for (let i = 0, l = event.length; i < l; i++) {
        // 针对当前遍历的事件，注册 fn 函数
        this.$on(event[i], fn)
      }
    } else {
      // vm._events 是保存事件及其回调函数的地方，数据结构如下所示：
      // {
      //   eventName1: [fn1, fn2, fn3, fn4],
      //   eventName2: [fn1, fn4, fn5],
      //   ......
      // }
      // vm._events 是一个对象，对象的 key 是注册进来的事件名，对象的 value 是数组，数组中保存着事件所对应的回调函数
      // 如果 vm._events[event] 不存在的话，则使用空数组初始化，然后使用 push 将 fn 函数添加到事件列表中。
      (vm._events[event] || (vm._events[event] = [])).push(fn)
      // optimize hook:event cost by using a boolean flag marked at registration
      // instead of a hash lookup
      if (hookRE.test(event)) {
        vm._hasHookEvent = true
      }
    }
    return vm
  }

  Vue.prototype.$once = function (event: string, fn: Function): Component {
    const vm: Component = this
    // $once 的实现思路是提供一个封装函数，将这个封装函数注册到 vm._events 中，当使用 vm.$emit('event')
    // 触发事件的时候，实际执行的是这个封装函数，然后在封装函数中使用 $off 移除掉封装函数 on，这样
    // 封装函数就不会再被 $emit 触发执行了，移除掉封装函数本身之后，再调用执行真正的业务函数 fn。
    // 这样就可以实现 fn 函数只能被 $emit 触发执行一次的效果了
    function on () {
      vm.$off(event, on)
      fn.apply(vm, arguments)
    }
    // 至于为什么要将 fn 赋值到 on.fn 呢？
    // 这是因为用户使用 $once 注册事件之后，有可能会使用 $off 移除使用 $once 注册的事件，
    // 用户的移除操作是 this.$off('event', fn)，但是实际注册的回调函数不是 fn，而是封装函数 on，
    // 所以用户执行的 this.$off('event', fn) 并不能达到预期的效果。
    //
    // Vue 的解决方案是将 fn 赋值到 on.fn，然后在 $off 函数中，判断如果 cb.fn === fn 的话，也
    // 会进行移除的操作。这样，用户执行 this.$off('event', fn) 就能够达到移除 fn 回调的效果了。
    on.fn = fn
    vm.$on(event, on)
    return vm
  }

  Vue.prototype.$off = function (event?: string | Array<string>, fn?: Function): Component {
    const vm: Component = this
    // 情况1：如果没有传递参数的话，则移除所有注册的事件和回调函数
    if (!arguments.length) {
      // 移除的方式是创建一个空的对象赋值到 vm._events
      vm._events = Object.create(null)
      return vm
    }
    // 如果 event 是数组的话，则遍历 event 数组，并依次调用 this.$off(event[i], fn)
    if (Array.isArray(event)) {
      for (let i = 0, l = event.length; i < l; i++) {
        this.$off(event[i], fn)
      }
      return vm
    }
    // 在这里处理单个的 event 事件，通过 vm._events[event] 获取 event 事件的回调函数数组
    const cbs = vm._events[event]
    // 如果 cbs 不存在的话，说明没有注册 event 事件，直接 return 返回即可
    if (!cbs) {
      return vm
    }
    // 情况2：判断是不是只有一个参数，如果是的话，则情形是：只提供了事件，没有提供回调函数
    if (arguments.length === 1) {
      // 此时将 vm._events 中的 event 事件数组设置为 null 即可
      vm._events[event] = null
      return vm
    }
    // 情况3：在这里判断有没有提供回调函数，如果提供了的话，则情形是：即提供了事件，也提供了回调函数
    // 此时需要移除指定事件的指定回调函数
    if (fn) {
      // specific handler
      let cb
      let i = cbs.length
      // 遍历回调函数数组 cbs
      // 这里有个细节是：遍历的方向是从后往前，因为这样移除掉某个回调函数的时候，
      // 不会影响前面未处理回调函数的位置。
      while (i--) {
        cb = cbs[i]
        // 如果 cb 等于 fn 或者 cb.fn 等于 fn 的话，说明当前的 cb 就是要移除的回调函数，
        // 使用 splice 将其移除掉即可。
        if (cb === fn || cb.fn === fn) {
          cbs.splice(i, 1)
          break
        }
      }
    }
    return vm
  }

  Vue.prototype.$emit = function (event: string): Component {
    const vm: Component = this

    if (process.env.NODE_ENV !== 'production') {
      const lowerCaseEvent = event.toLowerCase()
      if (lowerCaseEvent !== event && vm._events[lowerCaseEvent]) {
        tip(
          `Event "${lowerCaseEvent}" is emitted in component ` +
          `${formatComponentName(vm)} but the handler is registered for "${event}". ` +
          `Note that HTML attributes are case-insensitive and you cannot use ` +
          `v-on to listen to camelCase events when using in-DOM templates. ` +
          `You should probably use "${hyphenate(event)}" instead of "${event}".`
        )
      }
    }

    // 使用 event 事件名获取回调函数列表
    let cbs = vm._events[event]
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs
      const args = toArray(arguments, 1)
      // 遍历执行 cbs 中的回调函数
      for (let i = 0, l = cbs.length; i < l; i++) {
        try {
          cbs[i].apply(vm, args)
        } catch (e) {
          handleError(e, vm, `event handler for "${event}"`)
        }
      }
    }
    return vm
  }
}
