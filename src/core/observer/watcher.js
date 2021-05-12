/* @flow */

import { queueWatcher } from './scheduler'
import Dep, { pushTarget, popTarget } from './dep'

import {
  warn,
  remove,
  isObject,
  parsePath,
  _Set as Set,
  handleError
} from '../util/index'

import type { ISet } from '../util/index'

let uid = 0
/**
 * Watcher 负责解析表达式以及收集依赖项,
 * 并在表达式的值改变时触发执行回调.
 * Watcher 用于 $watch() 接口和指令.
 */
export default class Watcher {
  vm: Component;
  expression: string;
  cb: Function;
  id: number;
  deep: boolean;
  user: boolean;
  lazy: boolean;
  sync: boolean;
  dirty: boolean;
  active: boolean;
  deps: Array<Dep>;
  newDeps: Array<Dep>;
  depIds: ISet;
  newDepIds: ISet;
  getter: Function;
  value: any;

  constructor (
    vm: Component,
    expOrFn: string | Function,
    cb: Function,
    options?: Object
  ) {
    // vm 是 Vue 的实例，
    this.vm = vm
    // vm 的 _watchers 数组用于收集该实例中用到的 watcher 实例，在这里将自身（this）push 到 _watchers 数组中
    vm._watchers.push(this)
    // 进行 options 参数的处理
    // 如果传递了 options 的话
    if (options) {
      // deep、user、lazy 和 sync 是 Boolean 值，在这里进行处理
      this.deep = !!options.deep
      this.user = !!options.user
      this.lazy = !!options.lazy
      this.sync = !!options.sync
    } else {
      // 如果没有传递 options 的话，将这些数据都设为 false
      this.deep = this.user = this.lazy = this.sync = false
    }
    // 回调函数
    this.cb = cb
    // 每个 Watcher 实例都有一个唯一的 id，这个 id 是一个自增长的数字
    // 借助 uid 这个全局变量实现，每次都加一，然后赋值给 this.id
    this.id = ++uid // uid for batching
    this.active = true
    this.dirty = this.lazy // for lazy watchers
    // 一个 watcher 有可能监控多个数据的改变（一个数据也多可能被多个 watcher 监控，其实它们两者是多对多的关系）
    // 每个数据都有一个对应 dep 实例。
    // 在这里使用一个数组，保存当前 watcher 实例监控数据所对应的 dep 实例
    this.deps = []
    this.newDeps = []
    // dep 实例也有一个唯一的 id
    // 在这里使用 set 保存 deps 数组中 dep 实例的 id
    this.depIds = new Set()
    this.newDepIds = new Set()
    this.expression = process.env.NODE_ENV !== 'production'
      // 在非生产环境下，将 expOrFn 转换成字符串保存到 this.expression
      ? expOrFn.toString()
      : ''
    // parse expression for getter
    // getter 属性必须是一个函数，并且函数中有对使用到的值的读取操作（用于触发数据的 getter 函数，在 getter 函数中进行该数据依赖的收集）
    if (typeof expOrFn === 'function') {
      // 如果 expOrFn 是一个函数类型的话，直接将它赋值给 this.getter 即可
      this.getter = expOrFn
    } else {
      // 而如果是一个字符串类型的话，例如："a.b.c.d"，是一个数据的路径
      // 就将 parsePath(expOrFn) 赋值给 this.getter，
      // parsePath 能够读取这个路径字符串对应的数据（一样能触发 getter，触发数据的 getter 是关键）
      this.getter = parsePath(expOrFn)
      if (!this.getter) {
        // 如果 getter 没有声明的话，就给其赋值一个空函数
        this.getter = function () {}
        // 在非生产的环境下，发出警告
        process.env.NODE_ENV !== 'production' && warn(
          `Failed watching path: "${expOrFn}" ` +
          'Watcher only accepts simple dot-delimited paths. ' +
          'For full control, use a function instead.',
          vm
        )
      }
    }
    // 调用 this.get() 函数会进行依赖的收集操作
    // 如果是 lazy 特性的 watcher 的话，先不调用 this.get()；
    // 如果不是的话，在这里直接调用 this.get()，触发以来的收集；
    this.value = this.lazy
      ? undefined
      // 调用 get() 函数，
      : this.get()
  }

  /**
   * 执行 getter 函数, 进行依赖的收集
   */
  get () {
    // 将自身实例赋值到 Dep.target 这个静态属性上（保证全局都能拿到这个 watcher 实例），
    // 使得 getter 函数使用数据的 Dep 实例能够拿到这个 Watcher 实例，进行依赖的收集。
    pushTarget(this)
    let value
    const vm = this.vm
    try {
      // 执行 getter 函数，该函数执行时，会对响应式的数据进行读取操作，这个读取操作能够触发数据的 getter，
      // 在 getter 中会将 Dep.target 这个 Watcher 实例存储到该数据的 Dep 实例中，以此就完成了依赖的收集
      value = this.getter.call(vm, vm)
    } catch (e) {
      if (this.user) {
        handleError(e, vm, `getter for watcher "${this.expression}"`)
      } else {
        throw e
      }
    } finally {
      // "touch" every property so they are all tracked as
      // dependencies for deep watching
      if (this.deep) {
        traverse(value)
      }
      // 用于将父级组件的渲染 watcher 赋值到 Dep.target 上面
      popTarget()
      this.cleanupDeps()
    }
    // 将 expOrFn 对应的值返回出去
    return value
  }

  /**
   * 进行依赖的添加操作，这种操作是双向的，即：
   * （1）dep 实例会添加当前的 watcher 实例
   * （2）当前的 watcher 实例也会将这个 dep 保存到 newDeps 数组中
   */
  /**
   *
   */
  addDep (dep: Dep) {
    const id = dep.id
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * 清空已经收集的依赖
   */
  cleanupDeps () {
    let i = this.deps.length
    while (i--) {
      // 对当前 watcher 实例的 dep 实例的数组进行遍历
      const dep = this.deps[i]
      if (!this.newDepIds.has(dep.id)) {
        dep.removeSub(this)
      }
    }
    let tmp = this.depIds
    this.depIds = this.newDepIds
    this.newDepIds = tmp
    this.newDepIds.clear()
    tmp = this.deps
    this.deps = this.newDeps
    this.newDeps = tmp
    this.newDeps.length = 0
  }

  /**
   * Subscriber interface.
   * Will be called when a dependency changes.
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      queueWatcher(this)
    }
  }

  /**
   * Scheduler job interface.
   * Will be called by the scheduler.
   */
  run () {
    if (this.active) {
      const value = this.get()
      if (
        value !== this.value ||
        // Deep watchers and watchers on Object/Arrays should fire even
        // when the value is the same, because the value may
        // have mutated.
        isObject(value) ||
        this.deep
      ) {
        // set new value
        const oldValue = this.value
        this.value = value
        if (this.user) {
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          this.cb.call(this.vm, value, oldValue)
        }
      }
    }
  }

  /**
   * Evaluate the value of the watcher.
   * This only gets called for lazy watchers.
   */
  evaluate () {
    this.value = this.get()
    this.dirty = false
  }

  /**
   * Depend on all deps collected by this watcher.
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * Remove self from all dependencies' subscriber list.
   */
  teardown () {
    if (this.active) {
      // remove self from vm's watcher list
      // this is a somewhat expensive operation so we skip it
      // if the vm is being destroyed.
      if (!this.vm._isBeingDestroyed) {
        remove(this.vm._watchers, this)
      }
      let i = this.deps.length
      while (i--) {
        this.deps[i].removeSub(this)
      }
      this.active = false
    }
  }
}

/**
 * Recursively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 */
const seenObjects = new Set()
function traverse (val: any) {
  seenObjects.clear()
  _traverse(val, seenObjects)
}

function _traverse (val: any, seen: ISet) {
  let i, keys
  const isA = Array.isArray(val)
  if ((!isA && !isObject(val)) || !Object.isExtensible(val)) {
    return
  }
  if (val.__ob__) {
    const depId = val.__ob__.dep.id
    if (seen.has(depId)) {
      return
    }
    seen.add(depId)
  }
  if (isA) {
    i = val.length
    while (i--) _traverse(val[i], seen)
  } else {
    keys = Object.keys(val)
    i = keys.length
    while (i--) _traverse(val[keys[i]], seen)
  }
}
