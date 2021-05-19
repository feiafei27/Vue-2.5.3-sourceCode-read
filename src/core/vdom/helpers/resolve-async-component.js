/* @flow */

import {
  warn,
  once,
  isDef,
  isUndef,
  isTrue,
  isObject,
  hasSymbol
} from 'core/util/index'

import { createEmptyVNode } from 'core/vdom/vnode'

/**
 * 异步组件实现的本质是 2 次渲染，先渲染成注释节点，当组件加载成功后，再通过 forceRender 重新渲染
 *
 * Vue 高级异步组件 的实现是很巧妙的，很值得我们借鉴和学习
 */

function ensureCtor (comp: any, base) {
  if (
    comp.__esModule ||
    (hasSymbol && comp[Symbol.toStringTag] === 'Module')
  ) {
    comp = comp.default
  }
  return isObject(comp)
    ? base.extend(comp)
    : comp
}

// 创建一个空的 VNode，这个 VNode 会被渲染成一个注释节点
// 在这个 VNode 上附加一些额外的属性（asyncFactory、asyncMeta），表明这个虚拟节点是一个异步组件
export function createAsyncPlaceholder (
  factory: Function,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag: ?string
): VNode {
  const node = createEmptyVNode()
  node.asyncFactory = factory
  node.asyncMeta = { data, context, children, tag }
  return node
}

// 1：处理异步组件（工厂函数）
// 最终返回 该组件的构造函数
// Vue.component('HelloWorld', function (resolve, reject) {
//   // 这个特殊的 require 语法告诉 webpack
//   // 自动将编译后的代码分割成不同的块
//   // 下面的代码其实就是发送 ajax 请求，到后端获取这个组件的数据，
//   require(['./components/HelloWorld'], function (res) {
//     // 这个方法是发送 ajax 的回调函数，它是异步的，会在 ajax 请求完成后进行执行
//     // 它的执行时机要晚于同步代码
//     resolve(res)
//   })
// })

// 2：处理异步组件（工厂函数 + Promise）
// Vue.component('HelloWorld', () => import('./components/HelloWorld.vue'))

// 3：高级异步组件
// const AsyncComp = () => ({
//   // 需要加载的组件，应当是一个 Promise
//   component: import('./components/HelloWorld.vue'),
//   // 加载中应当渲染的组件
//   loading: LoadingComp,
//   // 出错时渲染的组件
//   error: ErrorComp,
//   // 渲染加载中组件前的等待时间。默认：200ms。
//   delay: 200,
//   // 最长等待时间。超出此时间则渲染错误组件。默认：Infinity
//   timeout: 1000
// })
export function resolveAsyncComponent (
  factory: Function,
  baseCtor: Class<Component>,
  context: Component
): Class<Component> | void {
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    return factory.errorComp
  }

  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  if (isDef(factory.contexts)) {
    // 收集 异步组件 所在的上下文（vm）
    factory.contexts.push(context)
  } else {
    // 收集 异步组件 所在的上下文（vm）
    const contexts = factory.contexts = [context]
    let sync = true

    const forceRender = () => {
      for (let i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate()
      }
    }

    // 异步组件工厂函数的 resolve 参数
    const resolve = once((res: Object | Class<Component>) => {
      // 将该异步组件的构造函数保存在 factory.resolved 上
      factory.resolved = ensureCtor(res, baseCtor)
      // invoke callbacks only if this is not a synchronous resolve
      // (async resolves are shimmed as synchronous during SSR)
      if (!sync) {
        // 异步组件已经通过 ajax 请求从后端获取到了，所以在这里需要对页面进行重新的渲染
        // 将异步组件渲染到页面上
        forceRender()
      }
    })

    // 异步组件工厂函数的 reject 参数
    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      if (isDef(factory.errorComp)) {
        factory.error = true
        forceRender()
      }
    })

    // 执行组件的工厂函数
    // 在组件的工厂函数中会执行这个组件的异步加载，通过发送 ajax 请求，
    // 获取组件的数据后，将组件的数据当做参数执行 resolve 方法
    const res = factory(resolve, reject)

    if (isObject(res)) {
      // 下面的代码块是用于处理 Promise 情况的
      // 如果我们：Vue.component() 的写法是返回一个 Promise 的话，那么上面 factory 方法的返回值就是一个 Promise
      if (typeof res.then === 'function') {
        // () => Promise
        if (isUndef(factory.resolved)) {
          // 将 resolve 和 reject 回调函数注册到 Promise.then() 中
          // 这样当 ajax 请求完成，这个 Promise 就是 resolved 的状态，然后就会执行 resolve 这个回调函数，接下来的逻辑和上面的工厂函数就一样了。
          res.then(resolve, reject)
        }
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        // 下面的代码快是针对 高级异步组件 的情况
        // 注册 resolve 和 reject 回调函数
        res.component.then(resolve, reject)

        if (isDef(res.error)) {
          // 创建 error 组件的构造函数，并保存在 errorComp 属性中
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }


        if (isDef(res.loading)) {
          // 创建 loading 组件的构造函数，并保存在 loadingComp 属性中
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          if (res.delay === 0) {
            // 如果 delay 为 0 的话，说明要立即进行加载中的状态
            factory.loading = true
          } else {
            // 如果 delay 不等于 0 的话，需要 delay 之后再进行 loading 的处理
            setTimeout(() => {
              // delay 毫秒之后，如果不是 resolved 和 error 的状态的话，说明当前是 loading 状态
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                // 将加载中的标志为 true，然后重新渲染视图
                factory.loading = true
                forceRender()
              }
            }, res.delay || 200)
          }
        }

        // timeout 参数表示：timeout 毫秒之后，如果这一个异步组件还不是 resolved 状态的话，
        // 就将组件设为 error 状态，并重新渲染，渲染出 error 组件
        if (isDef(res.timeout)) {
          setTimeout(() => {
            if (isUndef(factory.resolved)) {
              reject(
                process.env.NODE_ENV !== 'production'
                  ? `timeout (${res.timeout}ms)`
                  : null
              )
            }
          }, res.timeout)
        }
      }
    }

    sync = false
    // return in case resolved synchronously
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
