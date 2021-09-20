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
  // resolveAsyncComponent 函数会被多次触发执行，第一次执行，发送请求，获取异步组件的信息
  // 无论异步组件的信息是否正常获取，都会将相关信息赋值到 factory 上面，这里的相关信息包括
  // error、resolved、loading 等表示异步组件获取状态的变量，然后执行 forceRender 方法
  // 重新渲染，这会再次进入 resolveAsyncComponent 函数，此时就可以根据 error、resolved、loading
  // 等数据判断异步组件的加载状态，返回对象的组件信息
  //
  // 如果 factory.error 变量为 true 的话，说明异步组件加载失败了，此时需要判断 factory.errorComp
  // 有没有定义，如果定义了的话，则返回这个异步组件加载失败时应该显示的 error 组件
  if (isTrue(factory.error) && isDef(factory.errorComp)) {
    // 返回 error 组件
    return factory.errorComp
  }

  // 和上面同理，判断 factory.resolved 是否被定义，如果已经被定义的话，说明当前的异步组件加载成功
  // 此时返回这个异步组件的定义即可
  if (isDef(factory.resolved)) {
    return factory.resolved
  }

  // 和上面同理，异步组件的加载还有一个加载中的状态，并且可以定义对应的加载中组件，当异步组件正在加载中
  // 的时候，会显示这个加载中组件，源码实现就在这个地方
  //
  // 如果 factory.loading 为 true 并且 factory.loadingComp 被定义了的话，
  // 则返回加载中组件
  if (isTrue(factory.loading) && isDef(factory.loadingComp)) {
    return factory.loadingComp
  }

  // 当第一次执行到这时，此时是当前的异步组件第一次被使用，factory.contexts 肯定没有被定义，
  // 代码会进入 else 的逻辑，在 else 的逻辑中，factory.contexts 会被定义，这个 contexts
  // 是一个数组，数组中存储使用了当前异步组件的 Vue 实例
  //
  // 下次执行到这时，说明当前的异步组件被多次使用了，factory.contexts 已经被定义，此时将当前的 Vue 实例
  // push 到 factory.contexts 数组中即可
  //
  // 那么这个 factory.contexts 数组有什么用呢？其实这个数组用于存储当前这个异步组件在加载中的时候，使用了
  // 这个异步组件的 Vue 实例，也就是组件，当这个异步组件加载成功或者失败时，可以触发 contexts 数组中所有
  // Vue 实例的 $forceUpdate 方法，强制这些使用了当前异步组件的组件重新渲染，进而渲染出这个已经加载完成了
  // 的异步组件。
  if (isDef(factory.contexts)) {
    // 将使用了当前异步组件的 Vue 实例 push 到 factory.contexts 数组中
    factory.contexts.push(context)
  } else {
    // 当前的异步组件第一次被使用时，代码会执行到这，此时需要初始化 factory.contexts
    // 初始化时的数据是 [context]
    const contexts = factory.contexts = [context]
    let sync = true

    // 创建一个工具方法 forceRender，它的作用是遍历 factory.contexts 数组中的 Vue 实例
    // 执行这个 Vue 实例的 $forceUpdate 方法，强制这些组件进行重新渲染
    const forceRender = () => {
      for (let i = 0, l = contexts.length; i < l; i++) {
        contexts[i].$forceUpdate()
      }
    }

    // 创建异步组件工厂函数的 resolve 参数，是一个函数类型
    const resolve = once((res: Object | Class<Component>) => {
      // 这里的 res 是请求获取到的异步组件对象，通过 ensureCtor 可以创建出对应的组件构造函数
      // 内部借助了 extend 方法
      // 将该异步组件的构造函数保存在 factory.resolved 上
      factory.resolved = ensureCtor(res, baseCtor)
      if (!sync) {
        // 异步组件已经通过 ajax 请求从后端获取到了，所以在这里需要对组件重新渲染
        // 将异步组件渲染到页面上
        forceRender()
      }
    })

    // 创建异步组件工厂函数的 reject 参数，是一个函数类型
    const reject = once(reason => {
      process.env.NODE_ENV !== 'production' && warn(
        `Failed to resolve async component: ${String(factory)}` +
        (reason ? `\nReason: ${reason}` : '')
      )
      if (isDef(factory.errorComp)) {
        // 如果定义了 errorComp 组件的话，在这里将 factory.error 设置为 true
        // 并强制组件重新渲染，当组件重新渲染时，在上面的代码中，会直接返回 errorComp
        factory.error = true
        forceRender()
      }
    })

    // 执行组件的工厂函数
    // 在组件的工厂函数中会执行这个组件的异步加载，通过发送 ajax 请求，
    // 获取组件的数据后，将组件的数据当做参数执行 resolve 方法，resolve 方法会进行组件的重新加载
    const res = factory(resolve, reject)

    if (isObject(res)) {
      // 下面的代码块是用于处理 Promise 情况的
      // 如果我们：Vue.component() 的写法是返回一个 Promise 的话，那么上面 factory 方法的返回值就是一个 Promise
      if (typeof res.then === 'function') {
        // () => import('./my-async-component')
        if (isUndef(factory.resolved)) {
          // 将 resolve 和 reject 回调函数注册到 Promise.then() 中
          // 这样当 ajax 请求完成，这个 Promise 就是 resolved 的状态，
          // 然后就会执行 resolve 这个回调函数，接下来的逻辑和上面的工厂函数就一样了。
          res.then(resolve, reject)
        }
      } else if (isDef(res.component) && typeof res.component.then === 'function') {
        // 下面的代码块是针对 高级异步组件 的情况，此时 res 是一个对象，并且 res.component 是一个 Promise
        // 注册 resolve 和 reject 回调函数
        res.component.then(resolve, reject)

        // 处理 高级异步组件 中的 error
        if (isDef(res.error)) {
          // 创建 error 组件的构造函数，并保存在 errorComp 属性中
          factory.errorComp = ensureCtor(res.error, baseCtor)
        }

        // 处理 高级异步组件 中的 loading
        if (isDef(res.loading)) {
          // 创建 loading 组件的构造函数，并保存在 loadingComp 属性中
          factory.loadingComp = ensureCtor(res.loading, baseCtor)
          if (res.delay === 0) {
            // 如果 delay 为 0 的话，说明要立即进行加载中的状态
            factory.loading = true
          } else {
            // 如果 delay 不等于 0 的话，则需要 delay 之后再进行 loading 的处理
            // 此处使用 setTimeout(() => {}, res.delay || 200)
            setTimeout(() => {
              // delay 毫秒之后，如果不是 resolved 和 error 的状态的话，说明当前是 loading 状态
              if (isUndef(factory.resolved) && isUndef(factory.error)) {
                // 将加载中的标志为 true，然后重新渲染视图，渲染出加载组件
                factory.loading = true
                forceRender()
              }
            }, res.delay || 200)
          }
        }

        // timeout 参数表示：timeout 毫秒之后，如果这一个异步组件还不是 resolved 状态的话，
        // 就将组件设为 error 状态，并重新渲染，渲染出 error 组件，借助 setTimeout 和 reject 方法实现功能
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
    // 如果 factory.loading 为 true 的话，说明异步组件还在加载中，此时返回 loadingComp
    // 如果不为 true 的话，说明异步组件加载完成，返回 resolved 异步组件即可
    return factory.loading
      ? factory.loadingComp
      : factory.resolved
  }
}
