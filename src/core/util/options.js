/* @flow */

import config from '../config'
import { warn } from './debug'
import { nativeWatch } from './env'
import { set } from '../observer/index'

import {
  ASSET_TYPES,
  LIFECYCLE_HOOKS
} from 'shared/constants'

import {
  extend,
  hasOwn,
  camelize,
  toRawType,
  capitalize,
  isBuiltInTag,
  isPlainObject
} from 'shared/util'

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 */
/**
 * option 的合并策略
 */
const strats = config.optionMergeStrategies

/**
 * Options with restrictions
 */
if (process.env.NODE_ENV !== 'production') {
  strats.el = strats.propsData = function (parent, child, vm, key) {
    if (!vm) {
      warn(
        `option "${key}" can only be used during instance ` +
        'creation with the `new` keyword.'
      )
    }
    return defaultStrat(parent, child)
  }
}

/**
 * Helper that recursively merges two data objects together.
 */
function mergeData (to: Object, from: ?Object): Object {
  if (!from) return to
  let key, toVal, fromVal
  const keys = Object.keys(from)
  for (let i = 0; i < keys.length; i++) {
    key = keys[i]
    toVal = to[key]
    fromVal = from[key]
    if (!hasOwn(to, key)) {
      set(to, key, fromVal)
    } else if (isPlainObject(toVal) && isPlainObject(fromVal)) {
      mergeData(toVal, fromVal)
    }
  }
  return to
}

/**
 * Data
 */
export function mergeDataOrFn (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal
    }
    if (!parentVal) {
      return childVal
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn () {
      return mergeData(
        typeof childVal === 'function' ? childVal.call(this) : childVal,
        typeof parentVal === 'function' ? parentVal.call(this) : parentVal
      )
    }
  } else if (parentVal || childVal) {
    return function mergedInstanceDataFn () {
      // instance merge
      const instanceData = typeof childVal === 'function'
        ? childVal.call(vm)
        : childVal
      const defaultData = typeof parentVal === 'function'
        ? parentVal.call(vm)
        : parentVal
      if (instanceData) {
        return mergeData(instanceData, defaultData)
      } else {
        return defaultData
      }
    }
  }
}

// data 的合并策略
strats.data = function (
  parentVal: any,
  childVal: any,
  vm?: Component
): ?Function {
  if (!vm) {
    if (childVal && typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn(
        'The "data" option should be a function ' +
        'that returns a per-instance value in component ' +
        'definitions.',
        vm
      )

      return parentVal
    }
    return mergeDataOrFn.call(this, parentVal, childVal)
  }

  return mergeDataOrFn(parentVal, childVal, vm)
}

/**
 * Hooks and props are merged as arrays.
 */
function mergeHook (
  parentVal: ?Array<Function>,
  childVal: ?Function | ?Array<Function>
): ?Array<Function> {
  // 嵌套的三元运算符
  // 如果 childVal 没有定义的话，直接返回 parentVal
  return childVal
    // childVal 是定义了的，接下来看 parentVal 是否定义
    ? parentVal
      // parentVal 定义了的话，使用 concat 函数连接两者，concat 函数的参数既能是数组，也能是单个的元素
      ? parentVal.concat(childVal)
      // childVal 定义了，而 parentVal 没有定义，此时只要返回 childVal 即可
      // 不过要看 childVal 是否是数组类型。如果是的话，直接返回，不是的话，包装成数组再返回
      : Array.isArray(childVal)
        ? childVal
        : [childVal]
    : parentVal
  // 这种返回结果由两种变量决定，每个变量各有两种变化，共有四种组合的情形可以使用三元运算符简洁的实现
  // 很值得我们借鉴和学习
}

// 生命周期函数数组
// const LIFECYCLE_HOOKS = [
//   'beforeCreate',
//   'created',
//   'beforeMount',
//   'mounted',
//   'beforeUpdate',
//   'updated',
//   'beforeDestroy',
//   'destroyed',
//   'activated',
//   'deactivated',
//   'errorCaptured'
// ]
// 生命周期函数的合并策略
LIFECYCLE_HOOKS.forEach(hook => {
  strats[hook] = mergeHook
})

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */
function mergeAssets (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): Object {
  const res = Object.create(parentVal || null)
  if (childVal) {
    process.env.NODE_ENV !== 'production' && assertObjectType(key, childVal, vm)
    return extend(res, childVal)
  } else {
    return res
  }
}

ASSET_TYPES.forEach(function (type) {
  strats[type + 's'] = mergeAssets
})

/**
 * Watchers.
 *
 * Watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */
strats.watch = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  // work around Firefox's Object.prototype.watch...
  if (parentVal === nativeWatch) parentVal = undefined
  if (childVal === nativeWatch) childVal = undefined
  /* istanbul ignore if */
  if (!childVal) return Object.create(parentVal || null)
  if (process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = {}
  extend(ret, parentVal)
  for (const key in childVal) {
    let parent = ret[key]
    const child = childVal[key]
    if (parent && !Array.isArray(parent)) {
      parent = [parent]
    }
    ret[key] = parent
      ? parent.concat(child)
      : Array.isArray(child) ? child : [child]
  }
  return ret
}

/**
 * Other object hashes.
 */
strats.props =
strats.methods =
strats.inject =
strats.computed = function (
  parentVal: ?Object,
  childVal: ?Object,
  vm?: Component,
  key: string
): ?Object {
  if (childVal && process.env.NODE_ENV !== 'production') {
    assertObjectType(key, childVal, vm)
  }
  if (!parentVal) return childVal
  const ret = Object.create(null)
  extend(ret, parentVal)
  if (childVal) extend(ret, childVal)
  return ret
}
strats.provide = mergeDataOrFn

/**
 * 最基础的 options 合并策略
 */
const defaultStrat = function (parentVal: any, childVal: any): any {
  // 如果 childVal 未定义的话，返回 parentVal
  return childVal === undefined
    ? parentVal
    : childVal
}

/**
 * 验证组件名称
 */
function checkComponents (options: Object) {
  // 对配置对象的 components 字段进行遍历
  for (const key in options.components) {
    const lower = key.toLowerCase()
    // 判断组件是不是 Vue 中内置的组件(slot,component)
    // 判断组件是不是 HTML 预留的标签
    // 如果满足的话，打印出警告
    if (isBuiltInTag(lower) || config.isReservedTag(lower)) {
      warn(
        'Do not use built-in or reserved HTML elements as component ' +
        'id: ' + key
      )
    }
  }
}

/**
 * 对 Props 进行标准化：将所有形式的 prop 都转换成对象的形式。
 */
function normalizeProps (options: Object, vm: ?Component) {
  const props = options.props
  // 如果当前的 options 没有配置 props 的话，直接 return 即可
  if (!props) return
  // 最终要返回的对象
  const res = {}
  let i, val, name
  // props 可以配置成 ['xxx', 'xxx2', 'xxx3'] 这种形式
  if (Array.isArray(props)) {
    i = props.length
    while (i--) {
      val = props[i]
      if (typeof val === 'string') {
        name = camelize(val)
        res[name] = { type: null }
      } else if (process.env.NODE_ENV !== 'production') {
        warn('props must be strings when using array syntax.')
      }
    }
  } else if (isPlainObject(props)) {
    for (const key in props) {
      val = props[key]
      name = camelize(key)
      res[name] = isPlainObject(val)
        ? val
        : { type: val }
    }
  } else if (process.env.NODE_ENV !== 'production') {
    warn(
      `Invalid value for option "props": expected an Array or an Object, ` +
      `but got ${toRawType(props)}.`,
      vm
    )
  }
  options.props = res
}

/**
 * Normalize all injections into Object-based format
 */
function normalizeInject (options: Object, vm: ?Component) {
  const inject = options.inject
  const normalized = options.inject = {}
  if (Array.isArray(inject)) {
    for (let i = 0; i < inject.length; i++) {
      normalized[inject[i]] = { from: inject[i] }
    }
  } else if (isPlainObject(inject)) {
    for (const key in inject) {
      const val = inject[key]
      normalized[key] = isPlainObject(val)
        ? extend({ from: key }, val)
        : { from: val }
    }
  } else if (process.env.NODE_ENV !== 'production' && inject) {
    warn(
      `Invalid value for option "inject": expected an Array or an Object, ` +
      `but got ${toRawType(inject)}.`,
      vm
    )
  }
}

/**
 * Normalize raw function directives into object format.
 */
function normalizeDirectives (options: Object) {
  const dirs = options.directives
  if (dirs) {
    for (const key in dirs) {
      const def = dirs[key]
      if (typeof def === 'function') {
        dirs[key] = { bind: def, update: def }
      }
    }
  }
}

function assertObjectType (name: string, value: any, vm: ?Component) {
  if (!isPlainObject(value)) {
    warn(
      `Invalid value for option "${name}": expected an Object, ` +
      `but got ${toRawType(value)}.`,
      vm
    )
  }
}

/**
 * 将两个 options 对象合并成一个
 */
export function mergeOptions (
  parent: Object,
  child: Object,
  vm?: Component
): Object {
  if (process.env.NODE_ENV !== 'production') {
    // 对配置对象的 components 字段进行检测
    checkComponents(child)
  }

  if (typeof child === 'function') {
    child = child.options
  }

  // 标准化 child 中的 props、inject、directives
  normalizeProps(child, vm)
  normalizeInject(child, vm)
  normalizeDirectives(child)

  // 对应官方文档点击这里：https://cn.vuejs.org/v2/api/#extends
  // 配置选项中可以使用 extends 配置项，如果使用了该配置项的话，底层则递归调用 mergeOptions 方法，
  // 对 parent 和 extendsFrom 中的配置项进行合并
  const extendsFrom = child.extends
  if (extendsFrom) {
    parent = mergeOptions(parent, extendsFrom, vm)
  }
  // 对应官方文档点击这里：https://cn.vuejs.org/v2/api/#mixins
  // 配置选项中可以使用 mixins 配置项，如果使用了该配置项的话，底层则递归调用 mergeOptions 方法，
  // 对 parent 和 child.mixins[i] 中的配置项进行合并
  if (child.mixins) {
    for (let i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm)
    }
  }

  // 开始进行真正的合并逻辑
  const options = {}
  let key
  for (key in parent) {
    mergeField(key)
  }
  for (key in child) {
    // 如果当前遍历的 key 在 parent 中不存在的话，再执行 mergeField(key)
    if (!hasOwn(parent, key)) {
      mergeField(key)
    }
  }
  // 用于合并 parent options 和 child options 对象中某一个 key 的方法
  function mergeField (key) {
    // strats 是指合并策略集
    // strat 是指特定选项的合并策略，是一个函数
    const strat = strats[key] || defaultStrat
    // 使用这个合并策略对 parent 和 child 中指定的 key 进行合并
    options[key] = strat(parent[key], child[key], vm, key)
  }
  return options
}

/**
 * 该函数也很简单：从 options 中获取指定的资源并返回即可
 */
export function resolveAsset (
  options: Object,
  type: string,
  id: string,
  warnMissing?: boolean
): any {
  // 如果 id 不是字符串类型的话，直接 return
  if (typeof id !== 'string') {
    return
  }
  // options 的数据结构如下所示：
  // options:{
  //   components:{},
  //   directives:{},
  //   filters:{}
  // }
  const assets = options[type]
  // 判断 assets 对象本身有没有指定的 原始id、小驼峰id、大驼峰id
  // 如果有的话，直接返回
  // 判断 assets 对象本身是否存在原始id属性，如果有的话，直接返回
  if (hasOwn(assets, id)) return assets[id]
  // 判断 assets 对象本身是否存在小驼峰id属性，如果有的话，直接返回
  const camelizedId = camelize(id)
  if (hasOwn(assets, camelizedId)) return assets[camelizedId]
  // // 判断 assets 对象本身是否存在大驼峰id属性，如果有的话，直接返回
  const PascalCaseId = capitalize(camelizedId)
  if (hasOwn(assets, PascalCaseId)) return assets[PascalCaseId]
  // 如果 assets 对象本身 原始id、小驼峰id、大驼峰id 属性都不存在的话
  // 则判断 assets 的原型链上有没有指定的 原始id、小驼峰id、大驼峰id 属性
  const res = assets[id] || assets[camelizedId] || assets[PascalCaseId]
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    // 如果没有获取到指定资源的话，打印出警告
    warn(
      'Failed to resolve ' + type.slice(0, -1) + ': ' + id,
      options
    )
  }
  // 返回获取到的资源，可以是组件、
  return res
}
