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
  // 该字段用于标识当前的 watcher 实例，是用户自定义的 watcher，还是组件的渲染 watcher
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
    // 借助上面的四个变量，Vue想要实现的效果是：每次页面渲染，watcher 实例的 deps 数组都保存最新的依赖 dep 集合，不会保存页面已经不依赖了的数据的 dep
    // 同时页面已经不使用了的数据的 dep 实例也不会保存当前组件的渲染 watcher（防止不使用数据的变化触发页面的重新渲染，这是无用的、浪费性能的行为）

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
      // 依赖收集需要执行 addDep() 方法完成
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
      // cleanupDeps 函数用于将：在旧的dep集中存在，而在新的dep集中不存在的 dep 进行移除该依赖的操作；
      // 并且更新 deps 和 depIds 保存最新渲染的最新的 dep 集，并清空 newDeps 和 newDepIds；
      this.cleanupDeps()
    }
    // 将 expOrFn 对应的值返回出去
    return value
  }

  /**
   * 进行依赖的添加操作，这种操作是双向的，即：
   * （1）dep 实例会添加当前的 watcher 实例
   * （2）当前的 watcher 实例也会将这个 dep 保存到 newDeps 数组中
   *
   * newDepIds 和 newDeps：保存当前渲染，页面使用的最新数据的 dep 集
   * depIds 和 deps：保存上一次渲染，页面使用数据的 dep 集
   *
   * 有下面3种情况：
   * （1）某些 dep 新的 dep 集中存在，而在旧的 dep 集中不存在(8~10)；
   * （2）某些 dep 在新旧 dep 集中都存在(2~7)；
   * （3）某些 dep 在旧的 dep 集中存在，而在新的 dep 集不存在(1)；
   * 可以使用下面的图生动的诠释：
   *
   *         旧的dep集         新的dep集
   *  dep1       I
   *  ---------------------------------------
   *  dep2       I                I
   *  dep3       I                I
   *  dep4       I                I
   *  dep5       I                I
   *  dep6       I                I
   *  dep7       I                I
   *  ---------------------------------------
   *  dep8                        I
   *  dep9                        I
   *  dep10                       I
   *
   * （1）和（3）的差异需要在 addDep 函数和 cleanupDeps 函数中进行处理，保证 deps 和 depIds 保存着最新的 dep 集，依赖的收集也是最新的。
   */
  addDep (dep: Dep) {
    const id = dep.id
    // 通过 if (!this.newDepIds.has(id)) 防止同一 dep 重复进入里面的逻辑
    // 进入 if 代码块中的，每一次都是不同的 dep
    if (!this.newDepIds.has(id)) {
      this.newDepIds.add(id)
      this.newDeps.push(dep)
      // 如果某一个新添加的 dep 在旧的 dep 集中不存在的话，在这里需要进行新依赖的收集（消除第一种情况的差异）
      if (!this.depIds.has(id)) {
        dep.addSub(this)
      }
    }
  }

  /**
   * cleanupDeps 函数用于将：在旧的dep集中存在，而在新的dep集中不存在的 dep 进行移除该依赖的操作；
   * 并且更新 deps 和 depIds 保存最新渲染的最新的 dep 集，并清空 newDeps 和 newDepIds；
   */
  cleanupDeps () {
    let i = this.deps.length
    // 对旧的 dep 集进行遍历操作
    while (i--) {
      const dep = this.deps[i]
      // 如果旧的dep集中存在新的dep集不存在的dep，说明这个最新渲染的视图用不到这个 dep 所对应的数据，所以需要进行移除依赖的操作
      if (!this.newDepIds.has(dep.id)) {
        // 移除当前 watcher 对该 dep 的监控
        dep.removeSub(this)
      }
    }

    // 更新 deps 和 depIds 保存最新渲染的最新的 dep 集，并清空 newDeps 和 newDepIds；
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
   * 如果 watcher 实例依赖的数据改变的话，update 方法将被执行
   */
  update () {
    /* istanbul ignore else */
    if (this.lazy) {
      this.dirty = true
    } else if (this.sync) {
      this.run()
    } else {
      // 如果当前的 watcher 实例不是立即触发的话，需要将当前的 watcher 实例添加到 watcher 缓存数组中
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
      // 下面进行回调函数 cb 的处理
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
          // 当前的 watcher 是用户自定义 watcher
          try {
            this.cb.call(this.vm, value, oldValue)
          } catch (e) {
            handleError(e, this.vm, `callback for watcher "${this.expression}"`)
          }
        } else {
          // 当前的 watcher 是组件的渲染 watcher
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
   * 作用：让当前 watcher 所依赖数据的 dep 保存 Dep.target 这个 Watcher 实例
   */
  depend () {
    let i = this.deps.length
    while (i--) {
      this.deps[i].depend()
    }
  }

  /**
   * 用于将当前的 watcher 实例从依赖的所有数据的 dep 实例中移除，卸载操作。
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
