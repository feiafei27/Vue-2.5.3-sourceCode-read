/* @flow */

import type Watcher from './watcher'
import { remove } from '../util/index'

// 起到一个计数的作用，每实例化 Dep 类一次，uid 就会加一
let uid = 0

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 */
/**
 * 用于收集依赖的类
 * 所谓的依赖就是一个个的 Watcher 实例
 */
export default class Dep {
  // target 是一个静态的变量，可以在程序的任何地方使用 Dep.target 访问到这个变量
  // 他的作用是：在收集依赖的时候，将要收集的 Watcher 实例保存在这里，然后调用 dep.depend() 函数
  // 将这个 Watcher 实例保存到 Dep 的 subs 数组中
  static target: ?Watcher;
  id: number;
  // 用于收集依赖的数组
  subs: Array<Watcher>;

  constructor () {
    // 将当前的 uid 当做 id 赋值给 id
    this.id = uid++
    // 初始化保存依赖的数组 subs
    this.subs = []
  }

  // 向 subs 数组添加依赖的函数
  addSub (sub: Watcher) {
    this.subs.push(sub)
  }

  // 移除指定依赖的函数
  removeSub (sub: Watcher) {
    // 移除依赖的工具函数
    remove(this.subs, sub)
  }

  // 依赖函数
  // 执行该函数可以将 Dep.target 依赖 push 进 subs 数组中
  depend () {
    if (Dep.target) {
      Dep.target.addDep(this)
    }
  }

  // 触发 subs 数组中依赖的更新操作
  notify () {
    // 数组的 slice 函数具有拷贝的作用
    const subs = this.subs.slice()
    // 遍历 subs 数组中的依赖项
    for (let i = 0, l = subs.length; i < l; i++) {
      // 执行依赖项的 update 函数，触发执行依赖
      subs[i].update()
    }
  }
}

/**
 * 解读下面源码前的须知：
 * （1）在 Vue 中，Watcher 的监控级别是组件；
 * （2）每一个组件都对应着一个渲染 Watcher；
 */

/**
 * 在开发中，我们的页面结构是一个组件嵌套另一个组件，众多组件结合在一起形成了完整的应用。
 * 并且每一个渲染 Watcher 都对应着一个组件。
 *
 * 在处理父组件的时候，Vue 将父组件的渲染 watcher 赋值到 Dep.target 上。
 * 然后轮到处理嵌套的子组件的时候，Vue 会将父组件的渲染 watcher 放到 targetStack 栈中，将子组件的渲染 watcher 赋值到 Dep.target 上。
 * 子组件处理完毕之后，会执行 popTarget 操作，将保存在 targetStack 栈中的父组件的渲染 watcher 拿出来并赋值到 Dep.target 上。
 * 这样处理的话，Dep.target 就会一直保存当前正在处理的组件的 watcher 实例。
 *
 * 这里对栈数据结构的使用很值得我们借鉴和学习
 */

// 先将 Dep.target 的内容设置为 null
Dep.target = null
// 存储 Watcher 实例的栈
const targetStack = []

// 该函数用于将 Watcher 实例设置给 Dep.target
// 并且还会做缓存的处理，如果 Dep.target 已经设置了 Watcher 实例的话，先将它 push 到 targetStack 数组中，
// 然后再将 _target 设置到 Dep.target 上面
export function pushTarget (_target: Watcher) {
  if (Dep.target) targetStack.push(Dep.target)
  Dep.target = _target
}

// 该函数用于将 targetStack 数组中的 Watcher 实例 pop 出来并设值到 Dep.target 上面
export function popTarget () {
  Dep.target = targetStack.pop()
}
