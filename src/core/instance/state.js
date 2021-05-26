/* @flow */

import config from '../config'
import Dep from '../observer/dep'
import Watcher from '../observer/watcher'
import { isUpdatingChildComponent } from './lifecycle'

import {
  set,
  del,
  observe,
  observerState,
  defineReactive
} from '../observer/index'

import {
  warn,
  bind,
  noop,
  hasOwn,
  hyphenate,
  isReserved,
  handleError,
  nativeWatch,
  validateProp,
  isPlainObject,
  isServerRendering,
  isReservedAttribute
} from '../util/index'
import {queueWatcher} from "../observer/scheduler";

// 共享的对象属性定义
const sharedPropertyDefinition = {
  enumerable: true,
  configurable: true,
  get: noop,
  set: noop
}

// proxy(vm, `_data`, key)
export function proxy (target: Object, sourceKey: string, key: string) {
  // 下面的 this 指向 target
  sharedPropertyDefinition.get = function proxyGetter () {
    return this[sourceKey][key]
  }
  sharedPropertyDefinition.set = function proxySetter (val) {
    this[sourceKey][key] = val
  }
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

export function initState (vm: Component) {
  vm._watchers = []
  const opts = vm.$options
  if (opts.props) initProps(vm, opts.props)
  if (opts.methods) initMethods(vm, opts.methods)
  if (opts.data) {
    initData(vm)
  } else {
    observe(vm._data = {}, true /* asRootData */)
  }
  // 初始化计算属性
  if (opts.computed) initComputed(vm, opts.computed)
  // 初始化监听属性
  // nativeWatch的作用：Firefox has a "watch" function on Object.prototype...
  if (opts.watch && opts.watch !== nativeWatch) {
    // 进行侦听属性的初始化过程
    initWatch(vm, opts.watch)
  }
}

// 初始化 Props
function initProps (vm: Component, propsOptions: Object) {
  // 父组件传递给子组件的 Props 数据
  const propsData = vm.$options.propsData || {}
  // 存储子组件计算过后的值
  const props = vm._props = {}
  // cache prop keys so that future props updates can iterate using Array
  // instead of dynamic object key enumeration.
  const keys = vm.$options._propKeys = []
  const isRoot = !vm.$parent
  // root instance props should be converted
  observerState.shouldConvert = isRoot
  // 遍历 propsOptions（规范化后的 props 对象）
  for (const key in propsOptions) {
    keys.push(key)
    // 校验和求值
    // key：当前遍历的 propsOptions 对象的 key
    // propsOptions：规范化后的 props 对象
    // propsData：父组件传递给子组件的 Props 数据
    // vm：Vue 实例
    const value = validateProp(key, propsOptions, propsData, vm)
    /* istanbul ignore else */
    if (process.env.NODE_ENV !== 'production') {
      const hyphenatedKey = hyphenate(key)
      if (isReservedAttribute(hyphenatedKey) ||
          config.isReservedAttr(hyphenatedKey)) {
        warn(
          `"${hyphenatedKey}" is a reserved attribute and cannot be used as component prop.`,
          vm
        )
      }
      defineReactive(props, key, value, () => {
        if (vm.$parent && !isUpdatingChildComponent) {
          // 避免在子组件中直接修改 prop 的值，这样做的目的是为了：保证数据的单向流动。
          warn(
            `Avoid mutating a prop directly since the value will be ` +
            `overwritten whenever the parent component re-renders. ` +
            `Instead, use a data or computed property based on the prop's ` +
            `value. Prop being mutated: "${key}"`,
            vm
          )
        }
      })
    } else {
      // 将 props（vm._props）中的数据转换 成响应式的
      defineReactive(props, key, value)
    }
    // 进行代理的操作
    if (!(key in vm)) {
      // 将 vm.key 代理到 vm._props.key 上
      proxy(vm, `_props`, key)
    }
  }
  observerState.shouldConvert = true
}

// 初始化我们配置中写的 data 对象，传递的参数（vm）是当前 Vue 的实例
function initData (vm: Component) {
  // 取出配置对象中的 data 字段
  let data = vm.$options.data
  // data 字段有两种写法：（1）函数类型；（2）普通对象类型
  // 在这一步，还会将 data 赋值给 vm._data
  data = vm._data = typeof data === 'function'
    // 如果 data 是函数类型的话，借助 getData 函数拿到最终的 data 对象
    ? getData(data, vm)
    // 否则的话，直接返回 data 对象，如果没有配置 data 的话，就返回后面的 {}
    : data || {}
  // 如果 data 不是普通的对象（{k:v}）的话
  if (!isPlainObject(data)) {
    // 将 data 设为 {}
    data = {}
    // 如果实在开发环境的话，打印出警告
    process.env.NODE_ENV !== 'production' && warn(
      'data functions should return an object:\n' +
      'https://vuejs.org/v2/guide/components.html#data-Must-Be-a-Function',
      vm
    )
  }
  // proxy data on instance
  // 拿到 data 对象中的 key
  const keys = Object.keys(data)
  // 拿到我们定义的 props 和 methods
  const props = vm.$options.props
  const methods = vm.$options.methods
  // 获取 data 中 key 的个数
  let i = keys.length
  // 遍历 data 中的 key
  while (i--) {
    // 拿到当前的key
    const key = keys[i]
    if (process.env.NODE_ENV !== 'production') {
      if (methods && hasOwn(methods, key)) {
        // 如果是在开发模式下，并且我们自定义的 methods 中有和 key 同名的方法时，在这发出警告
        warn(
          `Method "${key}" has already been defined as a data property.`,
          vm
        )
      }
    }
    if (props && hasOwn(props, key)) {
      // 如果是在开发模式下，并且 props 有和 key 同名的属性时，在此发出警告
      process.env.NODE_ENV !== 'production' && warn(
        `The data property "${key}" is already declared as a prop. ` +
        `Use prop default value instead.`,
        vm
      )
      // isReserved 函数用于检查字符串是不是 $ 或者 _ 开头的
      // 如果不是 $ 和 _ 开头的话
    } else if (!isReserved(key)) {
      // 将 vm.key 代理到 vm['_data'].key
      // 也就是说当我们访问 this.message 的时候，实际上值是从 this['_data'].message 中获取到的(假设 data 中有 message 属性)
      proxy(vm, `_data`, key)
    }
  }
  // observe data
  observe(data, true /* asRootData */)
}

function getData (data: Function, vm: Component): any {
  try {
    // 使用 call 执行 data 函数，该函数中的 this 指向当前 Vue 的实例，并且第一个参数也是当前 Vue 的实例
    // 官网的 data 部分：https://cn.vuejs.org/v2/api/#data，中说道：如果函数是一个箭头函数的话，函数中的
    // this 就不是这个组件的实例了，不过仍然可以通过第一个参数来访问这个组件的实例。底层的原理就在这里。
    return data.call(vm, vm)
  } catch (e) {
    handleError(e, vm, `data()`)
    return {}
  }
}

const computedWatcherOptions = { lazy: true }

// 初始化计算属性
function initComputed (vm: Component, computed: Object) {
  // 每一个计算属性都有一个对应的 Watcher 实例
  // 所以 vm 会有一个 _computedWatchers 属性，专门用来保存这个 Watcher 实例
  const watchers = vm._computedWatchers = Object.create(null)
  // computed properties are just getters during SSR
  const isSSR = isServerRendering()

  // 遍历我们定义的计算属性，进行处理。
  for (const key in computed) {
    // 获取当前计算属性的定义
    const userDef = computed[key]
    // 获取该计算属性的 getter。因为计算属性既可以是函数类型，也可以是对象类型，所以在此需要处理一下。
    const getter = typeof userDef === 'function' ? userDef : userDef.get
    if (process.env.NODE_ENV !== 'production' && getter == null) {
      // 如果 getter 不存在的话，在此打印出警告
      warn(
        `Getter is missing for computed property "${key}".`,
        vm
      )
    }

    if (!isSSR) {
      // create internal watcher for the computed property.
      // 创建该计算属性对应的 Watcher 实例，计算属性的 Watcher 并不会立即执行 watcher.get()，是一个 lazy Watcher
      watchers[key] = new Watcher(
        vm,
        getter || noop,
        noop,
        computedWatcherOptions
      )
    }

    // component-defined computed properties are already defined on the
    // component prototype. We only need to define computed properties defined
    // at instantiation here.
    if (!(key in vm)) {
      // 如果计算属性的 key，在 data、prop 中不存在的话，在 vm 上进行定义
      defineComputed(vm, key, userDef)
    } else if (process.env.NODE_ENV !== 'production') {
      // 否则的话，则会打印出相应的警告
      if (key in vm.$data) {
        warn(`The computed property "${key}" is already defined in data.`, vm)
      } else if (vm.$options.props && key in vm.$options.props) {
        warn(`The computed property "${key}" is already defined as a prop.`, vm)
      }
    }
  }
}

export function defineComputed (
  target: any,
  key: string,
  userDef: Object | Function
) {
  // 在浏览器的环境下，shouldCache 为 true
  const shouldCache = !isServerRendering()
  // const sharedPropertyDefinition = {
  //   enumerable: true,
  //   configurable: true,
  //   get: noop,
  //   set: noop
  // }
  // sharedPropertyDefinition 就是一个共享的对象属性定义，我们需要为这个对象设置 get 和 set 方法
  // 下面的代码就是用于给这个对象设置 get 和 set 方法
  if (typeof userDef === 'function') {
    sharedPropertyDefinition.get = shouldCache
      // createComputedGetter 方法能够返回一个方法，返回的方法具有缓存的作用
      ? createComputedGetter(key)
      : userDef
    sharedPropertyDefinition.set = noop
  } else {
    sharedPropertyDefinition.get = userDef.get
      ? shouldCache && userDef.cache !== false
        ? createComputedGetter(key)
        : userDef.get
      : noop
    sharedPropertyDefinition.set = userDef.set
      ? userDef.set
      : noop
  }
  if (process.env.NODE_ENV !== 'production' &&
      sharedPropertyDefinition.set === noop) {
    sharedPropertyDefinition.set = function () {
      warn(
        `Computed property "${key}" was assigned to but it has no setter.`,
        this
      )
    }
  }
  // 借助 Object.defineProperty，向 target 上设置属性
  Object.defineProperty(target, key, sharedPropertyDefinition)
}

// createComputedGetter 方法能够返回一个方法，返回的方法具有缓存的作用
function createComputedGetter (key) {
  // 返回的方法会作为 get。具有缓存结果值的作用，实现的依据是 Watcher 实例的 dirty 属性，
  return function computedGetter () {
    // this 就是 vm
    // 拿到当前计算属性对应的 Watcher 实例
    const watcher = this._computedWatchers && this._computedWatchers[key]
    if (watcher) {
      // dirty 属性是一个标志位：标志着这个 Watcher 所依赖的数据有没有变化
      // 如果 Watcher 所依赖的数据没有变化的话，也就不用重新计算值（watcher.value）,直接返回 watcher.value 即可
      // 如果 watcher.dirty 为 true 的话，说明 watcher.value 还没有计算或者依赖的数据变化了，此时就需要重新计算
      if (watcher.dirty) {
        watcher.evaluate()
        // evaluate () {
        //   this.value = this.get()
        //   this.dirty = false
        // }
        // 我们可以看到，计算完 value 之后，将 dirty 设为 false，因为此时已经计算完值了，而且依赖的数据也没有变化
        // 那么接下来什么时候 dirty 会变成 true 呢？答案是：在依赖的数据变化了的时候，看下面的源码
        // update () {
        //   // lazy 属性为 true，说明当前的 watcher 实例是针对计算属性的，又因为依赖的数据发生了变化，此时需要将 dirty 设为 true
        //   if (this.lazy) {
        //     this.dirty = true
        //   }
        //       ......
        // }
      }
      // 下面代码的作用是：让组件的渲染 Watcher 监控 当前计算属性watcher所监控的数据。
      // 实现的效果：计算属性 watcher 所依赖的数据发生了变化的话，会触发组件的重新渲染。
      // 底层表现就是：当前计算属性的 Watcher 实例所依赖数据的 dep 实例的 subs 数组保存 组件的渲染 Watcher
      if (Dep.target) {
        watcher.depend()
      }
      return watcher.value
    }
  }
}

function initMethods (vm: Component, methods: Object) {
  const props = vm.$options.props
  for (const key in methods) {
    if (process.env.NODE_ENV !== 'production') {
      if (methods[key] == null) {
        warn(
          `Method "${key}" has an undefined value in the component definition. ` +
          `Did you reference the function correctly?`,
          vm
        )
      }
      if (props && hasOwn(props, key)) {
        warn(
          `Method "${key}" has already been defined as a prop.`,
          vm
        )
      }
      if ((key in vm) && isReserved(key)) {
        warn(
          `Method "${key}" conflicts with an existing Vue instance method. ` +
          `Avoid defining component methods that start with _ or $.`
        )
      }
    }
    vm[key] = methods[key] == null ? noop : bind(methods[key], vm)
  }
}

// 初始化侦听属性
function initWatch (vm: Component, watch: Object) {
  // 遍历用户定义的 watch 对象
  for (const key in watch) {
    // 获取当前 watch 对象的处理器
    // 处理器的类型可以是：函数、字符串、对象、数组
    // 如果是 函数、字符串、对象 类型的话，此时侦听的对象和处理器是一一对应的关系
    // 如果是 数组 类型的话，此时侦听的对象和处理器是一对多的关系
    const handler = watch[key]
    // 在这里处理是数组类型的情况
    // 在 createWatcher 方法中，handler 只会是 函数、字符串、对象 类型的
    if (Array.isArray(handler)) {
      // 所以，如果 handler 是一个数组的话，需要遍历 handler 数组，为每一个处理器都执行一下 createWatcher
      for (let i = 0; i < handler.length; i++) {
        createWatcher(vm, key, handler[i])
      }
    } else {
      createWatcher(vm, key, handler)
    }
  }
}

function createWatcher (
  vm: Component,
  keyOrFn: string | Function,
  // handler 只会是 函数、字符串、对象 类型的
  handler: any,
  options?: Object
) {
  // 如果 handler 是对象类型的话，需要进行下数据整形，确保 handler 指向处理函数，options 指向配置对象
  if (isPlainObject(handler)) {
    options = handler
    handler = handler.handler
  }
  // 如果 handler 是字符串类型的话，从 vm 实例中获取到对应的处理函数
  if (typeof handler === 'string') {
    handler = vm[handler]
  }
  // 调用 vm.$watch 实现侦听属性的功能
  // 代码执行到这里，handler 只能是函数类型的
  // 如果 vm 中的 key 发生了变化的话，会执行 handler 回调函数
  return vm.$watch(keyOrFn, handler, options)
}

export function stateMixin (Vue: Class<Component>) {
  // flow somehow has problems with directly declared definition object
  // when using Object.defineProperty, so we have to procedurally build up
  // the object here.
  const dataDef = {}
  dataDef.get = function () { return this._data }
  const propsDef = {}
  propsDef.get = function () { return this._props }
  if (process.env.NODE_ENV !== 'production') {
    dataDef.set = function (newData: Object) {
      warn(
        'Avoid replacing instance root $data. ' +
        'Use nested data properties instead.',
        this
      )
    }
    propsDef.set = function () {
      warn(`$props is readonly.`, this)
    }
  }
  Object.defineProperty(Vue.prototype, '$data', dataDef)
  Object.defineProperty(Vue.prototype, '$props', propsDef)

  Vue.prototype.$set = set
  Vue.prototype.$delete = del

  Vue.prototype.$watch = function (
    expOrFn: string | Function,
    cb: any,
    options?: Object
  ): Function {
    const vm: Component = this
    if (isPlainObject(cb)) {
      return createWatcher(vm, expOrFn, cb, options)
    }
    options = options || {}
    options.user = true
    // vm.$watch 方法的核心，借助 Watcher 实现功能
    const watcher = new Watcher(vm, expOrFn, cb, options)
    if (options.immediate) {
      // 如果 immediate 为 true 的话，立即执行回调函数
      cb.call(vm, watcher.value)
    }
    return function unwatchFn () {
      watcher.teardown()
    }
  }
}
