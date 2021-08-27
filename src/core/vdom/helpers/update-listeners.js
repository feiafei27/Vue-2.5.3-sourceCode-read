/* @flow */

import { warn } from 'core/util/index'
import { cached, isUndef } from 'shared/util'

// normalizeEvent 函数的作用是解析绑定的事件有没有使用修饰符，
//
// 使用了修饰符的事件名字符串的前面会有专门的标识字符，
// 例如：@click.once="btnOnceClick" 对应的事件名就是 "~click"。
const normalizeEvent = cached((name: string): {
  name: string,
  once: boolean,
  capture: boolean,
  passive: boolean
} => {
  const passive = name.charAt(0) === '&'
  name = passive ? name.slice(1) : name
  const once = name.charAt(0) === '~' // Prefixed last, checked first
  name = once ? name.slice(1) : name
  const capture = name.charAt(0) === '!'
  name = capture ? name.slice(1) : name
  // 返回解析完成的对象，name 属性是绑定的事件名
  // once、capture、passive 属性用于标识该事件有没有使用相应的修饰符，
  // 如果使用了的话，值就为 true，没有使用的话，值就为 false。
  //
  // 例如：@click.once="btnOnceClick"，则解析返回的对象如下所示：
  // {
  //   name: 'click',
  //   once: true,
  //   capture: false,
  //   passive: false
  // }
  return {
    name,
    once,
    capture,
    passive
  }
})

// createFnInvoker 可以将函数数组合并成一个函数，实现思路是返回一个封装函数，
// 在封装函数内，如果判断 fns 是一个数组的话，则遍历执行 fns 中的各个函数。
// 而如果 fns 是单个的函数的话，则在封装函数中直接执行 fns 函数。
export function createFnInvoker (fns: Function | Array<Function>): Function {
  // 事件触发时，真正执行的是这个返回的 invoker 函数，这是个封装函数，真正的业务函数是 invoker.fns
  function invoker () {
    // 取出业务函数 fns，它可能是个函数数组或者就是一个函数，需要进行判断，进行不同的处理
    const fns = invoker.fns
    if (Array.isArray(fns)) {
      // 如果 fns 是数组的话，则遍历执行 fns 中的函数
      const cloned = fns.slice()
      for (let i = 0; i < cloned.length; i++) {
        cloned[i].apply(null, arguments)
      }
    } else {
      // 如果 fns 不是函数数组，那它本身就是函数，在这里触发执行即可
      return fns.apply(null, arguments)
    }
  }
  // 将 fns 业务函数赋值到包装函数 invoker 的 fns 属性上
  invoker.fns = fns
  return invoker
}

// 对比 on 与 oldOn，然后根据对比的结果调用 add 方法或者 remove 方法执行绑定或解绑事件
// 该函数的一大特点是：add 和 remove 函数与 updateListeners 函数解耦，它们作为参数传递到
// updateListeners 方法中，updateListeners 方法主要做 on 与 oldOn 的比较。
export function updateListeners (
  on: Object,
  oldOn: Object,
  add: Function,
  remove: Function,
  vm: Component
) {
  let name, cur, old, event
  // 遍历处理 on 中的事件
  for (name in on) {
    // 根据事件名称（例如：click）获取对应的回调函数
    cur = on[name]
    old = oldOn[name]
    event = normalizeEvent(name)
    if (isUndef(cur)) {
      // 如果 cur 回调函数未定义的话，说明没有给这个事件绑定回调函数，打印出警告
      process.env.NODE_ENV !== 'production' && warn(
        `Invalid handler for event "${event.name}": got ` + String(cur),
        vm
      )
    } else if (isUndef(old)) {
      // 如果 old 回调函数未定义，cur 回调函数定义了的话，说明当前的事件是新增的
      // 需要执行 add 方法进行事件的绑定
      if (isUndef(cur.fns)) {
        cur = on[name] = createFnInvoker(cur)
      }
      add(event.name, cur, event.once, event.capture, event.passive)
    } else if (cur !== old) {
      // 如果 cur 和 old 都定义了，并且 cur !== old 的话，则执行到这里
      //
      // 执行到这里的情形是：之前和现在 DOM 元素都绑定了 name 事件，但是绑定的回调函数不一样，
      // 所以需要对执行的回调函数进行更新。更新的方式也很简单，将 cur 赋值到 old.fns 即可，
      // 至于为什么这样就能改变绑定的回调函数，看 createFnInvoker 函数的源码注释
      old.fns = cur
      on[name] = old
    }
  }
  // 遍历处理 oldOn 中的事件
  for (name in oldOn) {
    // 如果当前遍历的事件在 on 中不存在的话
    // 说明该事件以前绑定了，而最新的状态没有绑定，此时需要执行 remove 进行该事件的解绑操作
    if (isUndef(on[name])) {
      event = normalizeEvent(name)
      remove(event.name, oldOn[name], event.capture)
    }
  }
}
