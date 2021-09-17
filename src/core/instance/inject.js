/* @flow */

import { warn } from '../util/index'
import { hasSymbol } from 'core/util/env'
import { defineReactive, observerState } from '../observer/index'

// provide/inject 的工作原理：
// 小知识：Vue 实例可以通过 $parent 属性获取到父组件的 Vue 实例。
//
// provide：每个组件 provide 的对象会保存在当前 Vue 实例的 _provided 属性上
//
// inject：遍历当前组件 inject 数据的 key，然后从当前组件开始，看是否存在 _provided[provideKey]
// 如果存在的话，则将这个值作为 inject key 的值；而如果不存在的话，则以 $parent 为链条查看父组件的
// _provided[provideKey] 是否存在，如果还没有的话，则会一级一级的向上级进行查找，inject 数据查找完成
// 之后，借助 defineReactive 将 inject 值设置到当前的 Vue 实例 vm 上。

// provide 选项应该是一个对象或者是一个返回对象的函数
export function initProvide (vm: Component) {
  // 获取存储在 vm.$options 上的 provide 配置
  const provide = vm.$options.provide
  // 如果当前的组件配置了 provide 的话，再进行接下来的逻辑
  if (provide) {
    // provide 选项有可能是对象或者返回对象的函数
    // 如果 provide 是函数的话，则将 provide 函数的返回对象赋值给 vm._provided
    // 如果 provide 就是对象类型的话，则直接将 provide 值赋值给 vm._provided
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

// inject 选项应该是一个字符串数组或者对象
export function initInjections (vm: Component) {
  // resolveInject 方法用于解析 inject 的数据，return 的数据是对象类型
  // 例如：inject: ['foo', 'bar']
  // 生成的 result 对象数据结构如下所示：
  // {
  //   foo: 'xxxxx',
  //   bar: 'cccccc'
  // }
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    // 将 observerState.shouldConvert 设置为 false，这是为了防止 defineReactive 方法
    // 将 result[key] 数据本身进行响应式转换，只将 vm.[key] 转换成响应式就可以了。
    observerState.shouldConvert = false
    // 遍历 result 对象的 keys，对这些 inject 的数据定义到 vm 上，并且 vm.[key] 是响应式的
    Object.keys(result).forEach(key => {
      // 调用 defineReactive 方法将 inject 的数据定义到 vm 上，这样，在组件中就可以
      // 通过 this[injectKey] 访问到 inject 到当前组件中的数据了。
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    // 将 observerState.shouldConvert 恢复设置成 true
    observerState.shouldConvert = true
  }
}

// 解析 inject 的数据
export function resolveInject (inject: any, vm: Component): ?Object {
  // 代码执行在这里，inject 的数据结构如下所示：
  // {
  //   foo: {
  //     from: 'foo',
  //     default: 'xxxx'
  //   },
  //   bar: {
  //     from: 'jar',
  //     default: function(){
  //       return 'vvvv'
  //     }
  //   }
  // }
  // 为什么代码执行到这里，inject 的数据结构一定是对象的形式呢？inject 也有可能是字符串数组的形式啊？
  // 这是因为在 _init 函数中执行 initInjections 方法之前，会进行 options 的合并操作，这个合并
  // 操作会将 inject 的数据格式统一转换成对象的形式，方便后续代码的处理，所以代码执行到这里，
  // inject 一定是对象的形式
  if (inject) {
    // result 是最终要 return 的对象
    const result = Object.create(null)
    // 获取 inject 的 key 字符串数组
    const keys = hasSymbol
        ? Reflect.ownKeys(inject).filter(key => {
          /* istanbul ignore next */
          return Object.getOwnPropertyDescriptor(inject, key).enumerable
        })
        : Object.keys(inject)
    // 遍历 inject 的 key 字符串数组
    for (let i = 0; i < keys.length; i++) {
      // 当前在遍历的 inject key
      const key = keys[i]
      // 当前遍历的 inject key 对应的注入 provideKey
      const provideKey = inject[key].from
      // source 变量是 Vue 实例的引用，从当前 inject 的 Vue 实例开始，一级一级的向上查找目标 injectKey 的值
      let source = vm
      // 利用 while(){} 一级一级的向上查找
      while (source) {
        // 如果当前的 source 定义了 provide，并且定义的 provide 存在 provideKey 的话，
        // 则说明找到了目标 injectKey 的值
        if (source._provided && provideKey in source._provided) {
          // 将找到的 provideKey 值赋值到 result[key]，当前处理的 key 也就完成了
          result[key] = source._provided[provideKey]
          break
        }
        // 如果没有找到的话，则将 source 赋值为当前 Vue 实例的父级 Vue 实例，一级一级的向上找
        // 当找到顶级的 Vue 实例时，他的父级是 null，此时 while 也就结束了。
        source = source.$parent
      }
      // 如果 source 一直处理，到最后被赋值成了 null，则说明 inject key 没有找到目标 key 的 provide 值
      // 此时会进入 inject default 的处理逻辑
      if (!source) {
        // 判断当前的 inject[key] 有没有定义 default
        if ('default' in inject[key]) {
          // 此时，inject[key] 定义了 default，获取 default 定义 provideDefault
          const provideDefault = inject[key].default
          // provideDefault 既有可能是直接的数据，也有可能是返回数据的函数
          // 所以，在这里进行判断 provideDefault 是不是函数类型
          // 如果是函数类型的话，则执行 provideDefault 函数，并将返回值赋值给 result[key]
          // 如果不是函数类型的话，则说明 provideDefault 是直接的数据，将 provideDefault 直接赋值给 result[key] 即可
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          // 如果到最后，default 也没有定义的话，则在非生产环境下，打印出警告
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    // 将解析完成的 result 对象 return 出去
    return result
  }
}
