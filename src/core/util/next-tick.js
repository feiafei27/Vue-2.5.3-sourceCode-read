/* @flow */
/* globals MessageChannel */
import { noop } from 'shared/util'
import { handleError } from './error'
import { isIOS, isNative } from './env'

// 存储回调函数的数组
const callbacks = []
let pending = false

// 该函数的功能是：遍历 callbacks 数组，并执行其中的每一个回调函数，并且还有清空 callbacks 数组的操作。
function flushCallbacks () {
  pending = false
  const copies = callbacks.slice(0)
  callbacks.length = 0
  for (let i = 0; i < copies.length; i++) {
    copies[i]()
  }
}

// 能够将 flushCallbacks 作为回调函数添加到微任务队列中的函数
let microTimerFunc
// 能够将 flushCallbacks 作为回调函数添加到宏任务队列中的函数
let macroTimerFunc
// nextTick 方法的默认实现是使用 microTimerFunc（微任务队列）
let useMacroTask = false

// 根据运行环境的支持情况，给 microTimerFunc 和 macroTimerFunc 不同的实现
///////////////// macroTimerFunc 函数的实现 /////////////////
// macroTimerFunc 优先使用 setImmediate，但是 setImmediate 存在兼容性问题，
// 所以使用 MessageChannel 作为备选方案，如果 MessageChannel 也不支持的话，
// 则最终使用 setTimeout 将回调函数添加到宏任务队列中。
if (typeof setImmediate !== 'undefined' && isNative(setImmediate)) {
  macroTimerFunc = () => {
    setImmediate(flushCallbacks)
  }
} else if (typeof MessageChannel !== 'undefined' && (
  isNative(MessageChannel) ||
  // PhantomJS
  MessageChannel.toString() === '[object MessageChannelConstructor]'
)) {
  const channel = new MessageChannel()
  const port = channel.port2
  channel.port1.onmessage = flushCallbacks
  macroTimerFunc = () => {
    port.postMessage(1)
  }
} else {
  /* istanbul ignore next */
  macroTimerFunc = () => {
    setTimeout(flushCallbacks, 0)
  }
}

///////////////// microTimerFunc 函数的实现 /////////////////
// 如果当前浏览器支持 Promise 的话，则借助 Promise 将 flushCallbacks 放到微任务队列
// 如果不支持 Promise 的话，则添加微任务队列会被降级成添加到宏任务队列中。
if (typeof Promise !== 'undefined' && isNative(Promise)) {
  const p = Promise.resolve()
  microTimerFunc = () => {
    p.then(flushCallbacks)
    // in problematic UIWebViews, Promise.then doesn't completely break, but
    // it can get stuck in a weird state where callbacks are pushed into the
    // microtask queue but the queue isn't being flushed, until the browser
    // needs to do some other work, e.g. handle a timer. Therefore we can
    // "force" the microtask queue to be flushed by adding an empty timer.
    if (isIOS) setTimeout(noop)
  }
} else {
  // fallback to macro
  microTimerFunc = macroTimerFunc
}

/**
 * withMacroTask 函数的作用是：给 fn 回调函数做一层包装，保证 fn 函数在执行的过程中，如果修改了状态，
 * 那么更新 DOM 的操作会被推到宏任务队列中。
 */
export function withMacroTask (fn: Function): Function {
  return fn._withTask || (fn._withTask = function () {
    useMacroTask = true
    const res = fn.apply(null, arguments)
    useMacroTask = false
    return res
  })
}

/**
 * nextTick 有两种用法：
 * Vue.nextTick(function () {
 *   // DOM 更新了
 * })
 *
 * nextTick() 函数不传入回调函数的话，就使用 Promise 的形式
 * Vue.nextTick()
 *    .then(function () {
 *      // DOM 更新了
 *    })
 */
export function nextTick (cb?: Function, ctx?: Object) {
  // _resolve 变量是用于处理 Promise 情形的
  let _resolve
  // 将回调函数包装一层，保存到 callbacks 数组中
  // 使用包装函数的原因是：(1) Vue 可以在包装函数中对 cb 回调函数添加一些 try catch 的代码，使代码更加的健壮
  //                     (2) 如果没有传递 cb 回调函数的话，还可以提供 Promise 的形式
  callbacks.push(() => {
    if (cb) {
      try {
        cb.call(ctx)
      } catch (e) {
        handleError(e, ctx, 'nextTick')
      }
    // 下面的代码是给 Promise 用的
    } else if (_resolve) {
      _resolve(ctx)
    }
  })
  // 借助 pending 这个变量，可以确保在执行 flushCallbacks 前，if 里面的逻辑只执行一次，
  // 也就是确保在一次事件循环中只向任务队列中添加一个任务。
  // if 代码块中的逻辑，用于根据 useMacroTask 变量，将 flushCallbacks 函数是放在微任务队列中，还是宏任务队列中。
  if (!pending) {
    pending = true
    if (useMacroTask) {
      macroTimerFunc()
    } else {
      microTimerFunc()
    }
  }
  // 下面的代码是给 Promise 用的
  // $flow-disable-line
  if (!cb && typeof Promise !== 'undefined') {
    // 如果没有传递 cb 回调函数，并且 Promise 可以使用的话，就返回一个 Promise，在代码的外面可以使用 nextTick().then(()=>{}) 的形式
    // 这里最为精髓的一点是：将返回的 Promise 的 resolve 函数赋值给 _resolve，将 resolve Promise 的抓手交给了包装函数
    // 这样的话：在下一个 tick 执行包装函数的时候，就会 resolve 这个 Promise，进而执行 nextTick().then(()=>{}) .then() 中的函数
    return new Promise(resolve => {
      _resolve = resolve
    })
  }
}
