/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However when passing down props,
 * we don't want to force conversion because the value may be a nested value
 * under a frozen data structure. Converting it would defeat the optimization.
 */
export const observerState = {
  shouldConvert: true
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 */
/**
 * Observer 类用于将对象中的值都转换成响应式的，并且还会将本身的实例挂载到该值上(__ob__)。
 * 通过借助 Observer，可以将对象的某个 key 转换成 getter/setter 的形式，
 * 在 getter/setter 的函数中，可以为该对象的这个 key 进行依赖收集和触发更新
 */
export class Observer {
  // 被处理成响应式的数据，可以是对象类型或者是数组类型
  // （数组也是一种对象，不过在 Vue 中数组需要使用不同于对象的处理方法）
  value: any;
  dep: Dep;
  // number of vms that has this object as root $data
  // 将此对象作为根 $data 的 vms 数量
  vmCount: number;

  constructor (value: any) {
    // 将要被转换成响应式的数据保存到 this.value 中
    this.value = value
    // 如果当前的 value 是一个数组类型的话，那么这个 dep 将被用于保存这个数组的依赖
    this.dep = new Dep()
    // 现将 vmCount 的值设为 0
    this.vmCount = 0
    // 将当前类的实例设到被转换数据的 __ob__ 属性上
    def(value, '__ob__', this)
    // 判断当前被转换的值是不是数组类型
    // 数组类型和对象类型有不同的转换方法
    if (Array.isArray(value)) {
      // 数组一般使用 Array 原型上的方法去操作数组，所以我们需要拥有 "获知用户使用了这些方法" 的能力。
      // Vue 的做法是使用拦截器的机制，所谓的拦截器就是一个和 Array.prototype 很像的对象，上面也有
      // push，shift，unshift （能够改变数组内容的方法）之类的方法，这些方法是我们自定义的，所以我们
      // 可以在这里加上一些额外的功能。例如：触发该数组的依赖。

      // 下面代码的作用：就是将这个拦截器对象添加到 value 的原型链上(__proto__)或者直接将方法设到这个 value 上
      // 具体使用哪种方式要看当前的环境支不支持 __proto__
      const augment = hasProto // hasProto 是一个常量，用于判断当前的环境是否支持 __proto__
        // 如果支持的话，就使用 protoAugment 方法将拦截器对象设置到 value 的 __proto__ 上面
        ? protoAugment
        // 如果当前的环境不支持 __proto__ 的话，就将拦截器对象中的方法直接设到 value 上面
        : copyAugment
      // 执行 augment 函数，确保当我们执行数组上面能够改变数组内内容的方法时，我们能够拦截到
      augment(value, arrayMethods, arrayKeys)
      // 除了数组本身应该是响应式的，数组中的元素也应该是响应式的
      // observeArray 方法用于将数组中的元素都转换成响应式的
      this.observeArray(value)
    } else {
      // 用于将对象中的属性都转换成响应式的
      this.walk(value)
    }
  }

  /**
   * 该方法用于将 obj 中所有的 key 都转换成响应式的
   * 具体的做法是遍历 keys，每个 key 都执行 defineReactive 方法
   * defineReactive 方法用于将对象中具体的 key 转换成响应式的
   */
  walk (obj: Object) {
    const keys = Object.keys(obj)
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i], obj[keys[i]])
    }
  }

  /**
   * 用于将数组中的元素都转换成响应式的
   */
  observeArray (items: Array<any>) {
    for (let i = 0, l = items.length; i < l; i++) {
      // 对数组中的每个元素都执行 observe 方法
      observe(items[i])
    }
  }
}

// 辅助方法

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 */
/**
 * 该方法非常简单，直接 src 设置到 target 对象的 __proto__ 属性上
 */
function protoAugment (target, src: Object, keys: any) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 */
/**
 * 该方法用于将 src 对象上的属性和方法设置到 target 对象上面
 */
/* istanbul ignore next */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * 该函数用于获取某个值的 Observer 实例
 * 如果这个值不是响应式的话,就通过 new Observer(value) 将 value 转换成响应式的，并返回这个新创建的 Observer 对象
 * 如果这个值已经是响应式的了话，就直接返回该值的 __proto__ 属性（该属性就是一个 Observer实例）
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 如果这个值不是一个对象、或者这个值是一个虚拟节点实例的话，在这里直接 return
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  // 声明要返回的 ob 变量
  let ob: Observer | void
  // 如果当前 value 有 __ob__ 属性，且这个属性是 Observer 类的实例的话
  // 直接将 value.__ob__ 赋值给 ob
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    observerState.shouldConvert &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    // 传递进来的 value 并不是响应式的，在这里。通过 new Observer(value) 将其转换成响应式的
    // 并且返回 new 出来的实例
    ob = new Observer(value)
  }
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 */
/**
 * defineReactive 方法用于将对象中的 key 转换成响应式的
 */
export function defineReactive (
  // 对象
  obj: Object,
  // key
  key: string,
  // 值
  val: any,
  customSetter?: ?Function,
  // 浅的
  shallow?: boolean
) {
  // 如果 val 是一个对象类型的话，那么这个 dep 将用于保存 val 的依赖列表
  // 数组类型值的依赖列表保存在 observer.dep 中
  const dep = new Dep()

  // getOwnPropertyDescriptor：获取对象中指定 key 的自身属性描述符。
  // 自身属性描述符是指直接在对象上定义（而非从对象的原型继承）的描述符。
  const property = Object.getOwnPropertyDescriptor(obj, key)
  if (property && property.configurable === false) {
    return
  }

  // 获取 property 中的 getter 和 setter（如果有的话）。
  // 获取的 getter 和 setter 会在下面设置的 get 和 set 函数中执行
  // 因为在下面的代码中，Vue 会为这个 key 设置新的 getter 和 setter，这个操作会
  // 覆盖用户自定义的 getter 和 setter（如果用户设置了的话）。
  // 所以在这里，获取到 getter 和 setter，并在下面 Vue 设置的 getter 和 setter 中执行
  const getter = property && property.get
  const setter = property && property.set

  // 这个 childOb（Observer类的实例）中的 dep 是用来保存数组类型值的依赖的
  let childOb = !shallow && observe(val)
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter () {
      // 触发执行上面拿到的 getter
      const value = getter ? getter.call(obj) : val
      // 如果 Dep 上的静态属性 target 存在的话
      if (Dep.target) {
        // 向 dep 中添加依赖，依赖是 Watcher 的实例
        dep.depend()
        if (childOb) {
          // childOb.dep 用来存储数组类型值的依赖
          // 普通对象类型的值也会走到这里，数组类型和普通对象类型的值都会有 __ob__属性
          // 也就是说：对于某一 val 而言，除了将依赖收集到 dep 中，也会将依赖收集到 val.__ob__.dep 中
          childOb.dep.depend()
          // 如果值是数组类型的话
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      // getter 返回值
      return value
    },
    set: function reactiveSetter (newVal) {
      // 拿到旧的 value
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // 如果存在用户自定义的 setter 的话，用这个用户自定义的 setter 赋值这个 value
      if (setter) {
        setter.call(obj, newVal)
      } else {
        // 否则就直接将 newVal 赋值给 val
        val = newVal
      }
      // 将新设置值中的 keys 也转换成响应式的
      childOb = !shallow && observe(newVal)
      // 触发依赖的更新
      dep.notify()
    }
  })
}

/**
 * vm.$set 的底层实现
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  // 如果 target 是一个数组，并且 key 也是一个有效的数组索引值的话
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    // 设置数组的 length 属性，设置的属性值是 "数组原长度" 和 "key" 中的最大值
    target.length = Math.max(target.length, key)
    // 然后通过数组原型上的方法，将 val 添加到数组中
    // 在前面数组响应式源码的阅读中可以知道，通过数组原型的方法添加的元素，其是会被转换成响应式的
    target.splice(key, 1, val)
    return val
  }
  // 这里用于处理 key 已经存在于 target 中的情况
  if (hasOwn(target, key)) {
    // 由于这个 key 已经存在于对象中了，也就是说这个 key 已经被侦测了变化，在这里，只不过是修改下属性而已
    // 所以在这里，直接修改属性，并返回 val 即可
    target[key] = val
    return val
  }
  // 下面的代码用于处理对象新增属性的情况
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  // 如果 target 没有 __ob__ 属性的话，说明 target 并不是一个响应式的对象
  // 所以在这里也不需要做什么额外的处理，将 val 设到 target 上，并且返回这个 val 即可
  if (!ob) {
    target[key] = val
    return val
  }
  // 如果上面
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
/**
 * 当数组 value 被使用的时候，收集数组中元素的依赖
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
