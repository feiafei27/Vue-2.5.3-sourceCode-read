/* @flow */

import { mergeOptions } from '../util/index'

export function initMixin (Vue: GlobalAPI) {
  // Vue.mixin 的作用是将 mixin 对象混入到 Vue.options 之中
  // 之后每次 new Vue 的时候，还会将子组件的 options 和 Vue.options 合并到一起
  // 这样，该子组件就能够访问使用到 mixin 中的属性和方法了
  Vue.mixin = function (mixin: Object) {
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
