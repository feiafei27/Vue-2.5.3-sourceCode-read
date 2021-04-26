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
  this._init(options)
}

// 下面函数的作用是：往 Vue 的原型上混入原型方法
initMixin(Vue)
stateMixin(Vue)
eventsMixin(Vue)
lifecycleMixin(Vue)
renderMixin(Vue)

export default Vue
