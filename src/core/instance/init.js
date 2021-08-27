/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import {extend, mergeOptions, formatComponentName, warn} from '../util/index'

let uid = 0

export function initMixin (Vue: Class<Component>) {
  // _init 方法会在 new Vue() 的时候调用，看下面的代码：
  // function Vue (options) {
  //   this._init(options)
  // }
  Vue.prototype._init = function (options?: Object) {
    // vm 就是 Vue 的实例对象，在 _init 方法中会对 vm 进行一系列的初始化操作
    const vm: Component = this
    // 赋值唯一的 id
    vm._uid = uid++

    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // a flag to avoid this being observed
    // 一个标记，用于防止 vm 变成响应式的数据
    vm._isVue = true
    // 下面这个 if else 分支需要注意一下。
    // 在 Vue 中，有两个时机会创建 Vue 实例，一个是 main.js 中手动执行的 new Vue({})，还有一个是当我们
    // 在模板中使用组件时，每使用一个组件，就会创建与之相对应的 Vue 实例。也就是说 Vue 的实例有两种，一种是
    // 手动调用的 new Vue，还有一种是组件的 Vue 实例。组件的 Vue 实例会进入下面的 if 分支，而手动调用的
    // new Vue 会进入下面的 else 分支。
    //
    // 合并 options，options 用于保存当前 Vue 组件能够使用的各种资源和配置，例如：组件、指令、过滤器等等
    if (options && options._isComponent) {
      // optimize internal component instantiation
      // since dynamic options merging is pretty slow, and none of the
      // internal component options needs special treatment.
      initInternalComponent(vm, options)
    } else {
      // options 中保存的是当前组件能够使用资源和配置，这些都是当前组件私有的。
      // 但还有一些全局的资源，例如：使用 Vue.component、Vue.filter 等注册的资源，
      // 这些资源都是保存到 Vue.options 中，因为是全局的资源，所以当前的组件也要能访问到，
      // 所以在这里，将这个保存全局资源的 options 和当前组件的 options 进行合并，并保存到 vm.$options
      vm.$options = mergeOptions(
        // resolveConstructorOptions 函数的返回值是 Vue 的 options
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // expose real self
    vm._self = vm
    // 初始化与生命周期有关的内容
    initLifecycle(vm)
    // 初始化与事件有关的属性以及处理父组件绑定到当前组件的方法。
    initEvents(vm)
    // 初始化与渲染有关的内容
    initRender(vm)
    // 在 beforeCreate 回调函数中，访问不到实例中的数据，因为这些数据还没有初始化
    // 执行 beforeCreate 生命周期函数
    callHook(vm, 'beforeCreate')
    // 解析初始化当前组件的 inject
    initInjections(vm) // resolve injections before data/props
    // 初始化 state，包括 props、methods、data、computed、watch
    initState(vm)
    // 初始化 provide
    initProvide(vm) // resolve provide after data/props
    // 在 created 回调函数中，可以访问到实例中的数据
    // 执行 created 回调函数
    callHook(vm, 'created')
    // beforeCreate 和 created 生命周期的区别是：能否访问到实例中的变量

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    // 如果配置中有 el 的话，则自动执行挂载操作
    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  opts.parent = options.parent
  opts.propsData = options.propsData
  opts._parentVnode = options._parentVnode
  opts._parentListeners = options._parentListeners
  opts._renderChildren = options._renderChildren
  opts._componentTag = options._componentTag
  opts._parentElm = options._parentElm
  opts._refElm = options._refElm
  if (options.render) {
    opts.render = options.render
    opts.staticRenderFns = options.staticRenderFns
  }
}

export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const extended = Ctor.extendOptions
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = dedupe(latest[key], extended[key], sealed[key])
    }
  }
  return modified
}

function dedupe (latest, extended, sealed) {
  // compare latest and sealed to ensure lifecycle hooks won't be duplicated
  // between merges
  if (Array.isArray(latest)) {
    const res = []
    sealed = Array.isArray(sealed) ? sealed : [sealed]
    extended = Array.isArray(extended) ? extended : [extended]
    for (let i = 0; i < latest.length; i++) {
      // push original options and not sealed options to exclude duplicated options
      if (extended.indexOf(latest[i]) >= 0 || sealed.indexOf(latest[i]) < 0) {
        res.push(latest[i])
      }
    }
    return res
  } else {
    return latest
  }
}
