/* @flow */

import config from '../config'
import { initUse } from './use'
import { initMixin } from './mixin'
import { initExtend } from './extend'
import { initAssetRegisters } from './assets'
import { set, del } from '../observer/index'
import { ASSET_TYPES } from 'shared/constants'
import builtInComponents from '../components/index'

import {
  warn,
  extend,
  nextTick,
  mergeOptions,
  defineReactive
} from '../util/index'

export function initGlobalAPI (Vue: GlobalAPI) {
  // config
  const configDef = {}
  configDef.get = () => config
  if (process.env.NODE_ENV !== 'production') {
    configDef.set = () => {
      warn(
        'Do not replace the Vue.config object, set individual fields instead.'
      )
    }
  }
  Object.defineProperty(Vue, 'config', configDef)

  // exposed util methods.
  // NOTE: these are not considered part of the public API - avoid relying on
  // them unless you are aware of the risk.
  // 应用于 Vue 源码内部的工具函数，不建议程序员直接使用。
  Vue.util = {
    warn,
    extend,
    mergeOptions,
    defineReactive
  }

  // 定义全局 API。set、delete、nextTick
  Vue.set = set
  Vue.delete = del
  Vue.nextTick = nextTick

  // 定义 options 对象，该对象用于存储一系列的资源，如：组件、指令和过滤器
  Vue.options = Object.create(null)
  ASSET_TYPES.forEach(type => {
    Vue.options[type + 's'] = Object.create(null)
  })

  // this is used to identify the "base" constructor to extend all plain-object
  // components with in Weex's multi-instance scenarios.
  Vue.options._base = Vue

  // 将与平台无关的内建组件存储到 options.components 中
  extend(Vue.options.components, builtInComponents)

  // 初始化 Vue.use()
  initUse(Vue)
  // 初始化 Vue.mixin()
  initMixin(Vue)
  // 初始化 Vue.extend()
  initExtend(Vue)
  // 初始化 Vue.component()、Vue.directive()、Vue.filter()，用于向 Vue 中注册资源
  initAssetRegisters(Vue)
}
