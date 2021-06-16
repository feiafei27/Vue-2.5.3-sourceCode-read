import { initMixin } from './init'
import { stateMixin } from './state'
import { renderMixin } from './render'
import { eventsMixin } from './events'
import { lifecycleMixin } from './lifecycle'
import { warn } from '../util/index'

function Vue (options) {
  // 如果当前的环境不是生产环境，并且当前命名空间中的 this 不是 Vue 的实例的话
  // 发出警告，Vue 必须通过 new Vue({}) 使用，而不是把 Vue 当做函数使用
  if (process.env.NODE_ENV !== 'production' &&
    !(this instanceof Vue)
  ) {
    warn('Vue is a constructor and should be called with the `new` keyword')
  }
  // 执行 vm 原型上的 _init 方法，该方法在 initMixin 方法中定义
  this._init(options)
}

// 下面函数的作用是：往 Vue 的原型上写入原型函数，这些函数是给 Vue 的实例使用的
// 这些函数分为两类：一类是 Vue 内部使用的，特征是函数名以 '_' 开头；
//                 还有一类是给用户使用的，特征是函数名以 '$' 开头，这些函数可以在 Vue 的官方文档中看到;
// 写入 vm._init
initMixin(Vue)
// 写入 vm.$set、vm.$delete、vm.$watch
stateMixin(Vue)
// 写入 vm.$on、vm.$once、vm.$off、vm.$emit
eventsMixin(Vue)
// 写入 vm._update、vm.$forceUpdate、vm.$destroy
lifecycleMixin(Vue)
// 写入 vm.$nextTick、vm._render
renderMixin(Vue)

export default Vue
