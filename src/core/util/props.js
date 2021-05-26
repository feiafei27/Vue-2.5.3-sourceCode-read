/* @flow */

import { warn } from './debug'
import { observe, observerState } from '../observer/index'
import {
  hasOwn,
  isObject,
  toRawType,
  hyphenate,
  capitalize,
  isPlainObject
} from 'shared/util'

type PropOptions = {
  type: Function | Array<Function> | null,
  default: any,
  required: ?boolean,
  validator: ?Function
};

// 对 Prop 进行校验和求值
export function validateProp (
  key: string,
  propOptions: Object,
  propsData: Object,
  vm?: Component
): any {
  // 拿到这个 prop 的定义
  const prop = propOptions[key]
  // 判断父组件传递的 Props 中有传递 key 对应的值。如果没有，absent 则为 true
  const absent = !hasOwn(propsData, key)
  // 拿到父组件传递的 Props 中对应 key 的值
  let value = propsData[key]
  // （1）对布尔类型的 Prop 进行处理
  // 判断是不是 Boolean 的类型
  if (isType(Boolean, prop.type)) {
    if (absent && !hasOwn(prop, 'default')) {
      // 如果父组件没有传递该 prop，并且没有配置默认值的话，则直接设为 false
      value = false
    } else if (!isType(String, prop.type) && (value === '' || value === hyphenate(key))) {
      // 如果该 prop 不是字符串类型，并且没有传递值或者传递了 true 值的话，则将 value 设为 true
      value = true
    }
  }
  // （2）对默认值的处理：如果父组件没有传递该 prop 值的话，则进行默认值的处理
  if (value === undefined) {
    value = getPropDefaultValue(vm, prop, key)
    // since the default value is a fresh copy,
    // make sure to observe it.
    const prevShouldConvert = observerState.shouldConvert
    observerState.shouldConvert = true
    observe(value)
    observerState.shouldConvert = prevShouldConvert
  }
  // （3）在非生产环境下，对 Prop 进行断言
  if (process.env.NODE_ENV !== 'production') {
    assertProp(prop, key, value, vm, absent)
  }
  return value
}

/**
 * 试图获取 prop 的默认值
 */
function getPropDefaultValue (vm: ?Component, prop: PropOptions, key: string): any {
  // 如果父组件没有传递该 prop 的值，并且也没有配置 prop 的话，则直接返回 undefined 即可
  if (!hasOwn(prop, 'default')) {
    return undefined
  }
  const def = prop.default
  // Object/Array 类型的 prop 的 default 必须是一个工厂函数，如果不满足的话，在这里进行警告
  if (process.env.NODE_ENV !== 'production' && isObject(def)) {
    warn(
      'Invalid default value for prop "' + key + '": ' +
      'Props with type Object/Array must use a factory function ' +
      'to return the default value.',
      vm
    )
  }
  // 一个优化点，出现在重新渲染的时候。如果父组件没有传递该 Prop，并且子组件已经有这个 prop 值的话。直接返回 vm._props[key] 即可
  // 可以避免不必要的 watcher 函数触发
  // 例如：有一个 prop，其有 default 配置，并且初次渲染以及更新渲染时都没有通过父组件传递这个 prop，则能用到这个优化点
  if (vm && vm.$options.propsData &&
    vm.$options.propsData[key] === undefined &&
    vm._props[key] !== undefined
  ) {
    return vm._props[key]
  }
  // 调用该 Prop 配置的 default 工厂函数，获取并返回默认值
  return typeof def === 'function' && getType(prop.type) !== 'Function'
    ? def.call(vm)
    : def
}

/**
 * Assert whether a prop is valid.
 */
function assertProp (
  prop: PropOptions,
  name: string,
  value: any,
  vm: ?Component,
  absent: boolean
) {
  // 如果当前的 prop 是必填，但是父组件没有传递该 prop 的值的话，则打印出该警告
  if (prop.required && absent) {
    warn(
      'Missing required prop: "' + name + '"',
      vm
    )
    return
  }
  if (value == null && !prop.required) {
    return
  }
  // 对 prop 类型的判断，不满足配置 type 的话，则打印出相应的警告
  let type = prop.type
  let valid = !type || type === true
  const expectedTypes = []
  if (type) {
    if (!Array.isArray(type)) {
      type = [type]
    }
    for (let i = 0; i < type.length && !valid; i++) {
      const assertedType = assertType(value, type[i])
      expectedTypes.push(assertedType.expectedType || '')
      valid = assertedType.valid
    }
  }
  if (!valid) {
    warn(
      `Invalid prop: type check failed for prop "${name}".` +
      ` Expected ${expectedTypes.map(capitalize).join(', ')}` +
      `, got ${toRawType(value)}.`,
      vm
    )
    return
  }
  // 使用用户自定义的 validator 方法，对传递进来的 value 进行验证
  const validator = prop.validator
  if (validator) {
    if (!validator(value)) {
      warn(
        'Invalid prop: custom validator check failed for prop "' + name + '".',
        vm
      )
    }
  }
}

const simpleCheckRE = /^(String|Number|Boolean|Function|Symbol)$/

function assertType (value: any, type: Function): {
  valid: boolean;
  expectedType: string;
} {
  let valid
  const expectedType = getType(type)
  if (simpleCheckRE.test(expectedType)) {
    const t = typeof value
    valid = t === expectedType.toLowerCase()
    // for primitive wrapper objects
    if (!valid && t === 'object') {
      valid = value instanceof type
    }
  } else if (expectedType === 'Object') {
    valid = isPlainObject(value)
  } else if (expectedType === 'Array') {
    valid = Array.isArray(value)
  } else {
    valid = value instanceof type
  }
  return {
    valid,
    expectedType
  }
}

/**
 * Use function string name to check built-in types,
 * because a simple equality check will fail when running
 * across different vms / iframes.
 */
function getType (fn) {
  const match = fn && fn.toString().match(/^\s*function (\w+)/)
  return match ? match[1] : ''
}

function isType (type, fn) {
  if (!Array.isArray(fn)) {
    return getType(fn) === getType(type)
  }
  for (let i = 0, len = fn.length; i < len; i++) {
    if (getType(fn[i]) === getType(type)) {
      return true
    }
  }
  /* istanbul ignore next */
  return false
}
