/* @flow */

import { ASSET_TYPES } from 'shared/constants'
import { warn, extend, mergeOptions } from '../util/index'
import { defineComputed, proxy } from '../instance/state'

export function initExtend (Vue: GlobalAPI) {
  /**
   * 每个实例构造函数（包括Vue）都有一个唯一的 cid，用于唯一标识实例构造函数
   */
  Vue.cid = 0
  let cid = 1

  // 对应官网：https://cn.vuejs.org/v2/api/#Vue-extend
  // 使用基础 Vue 构造器，创建一个“子类”。参数是一个包含组件选项的对象。
  Vue.extend = function (extendOptions: Object): Function {
    extendOptions = extendOptions || {}
    // Super = this = 父级构造器
    const Super = this
    // 拿到父级构造器的 cid
    const SuperId = Super.cid
    // extendOptions._Ctor 对象用于缓存这一个 extendOptions 对象已经创建了的构造函数
    // 缓存的 key 是父级构造器的 cid。
    // extendOptions + cid 能够唯一确定某一个子类构造器
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) {
      // 如果 extendOptions 已经和这一个父级构造器生成了子级构造器的话，
      // 在这里，直接 return 缓存中的子级构造器
      return cachedCtors[SuperId]
    }

    // 组件 name 校验
    const name = extendOptions.name || Super.options.name
    if (process.env.NODE_ENV !== 'production') {
      // 非生产环境下，如果不合规范的话，打印出警报
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        warn(
          'Invalid component name: "' + name + '". Component names ' +
          'can only contain alphanumeric characters and the hyphen, ' +
          'and must start with a letter.'
        )
      }
    }

    // 定义子构造函数 Sub
    const Sub = function VueComponent (options) {
      this._init(options)
    }
    // 将父级构造函数的原型对象赋值给 Sub.prototype
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    // 赋值自增长的 cid
    Sub.cid = cid++
    // 下面是实现继承的关键，使用 mergeOptions 方法将 父级的options 和 extendOptions 进行合并
    // 并将结果赋值给 Sub 子构造函数的 options 属性上
    Sub.options = mergeOptions(
      Super.options,
      extendOptions
    )
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // 赋值全局的静态方法
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    Sub.use = Super.use

    // ASSET_TYPES = [ 'component', 'directive', 'filter' ]
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub
    }

    // 在 Sub 函数上面保存：(1)父级的 options;(2)当前拓展的 extendOptions;(3)上面两个 options 合并后的 options
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // 缓存创建的 Sub 子构造器
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps (Comp) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed (Comp) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
