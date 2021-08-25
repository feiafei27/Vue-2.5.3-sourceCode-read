/* @flow */

import { enter, leave } from '../modules/transition'

// recursively search for possible transition defined inside the component root
function locateNode (vnode: VNode): VNodeWithData {
  return vnode.componentInstance && (!vnode.data || !vnode.data.transition)
    ? locateNode(vnode.componentInstance._vnode)
    : vnode
}

export default {
  // v-show 第一次被绑定到元素上时调用（oldVNode 没有使用 v-show 指令，而 vnode 使用了 v-show 指令）
  bind (el: any, { value }: VNodeDirective, vnode: VNodeWithData) {
    // value 参数是 v-show 后面表达式当前的值
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition
    // 获取在 el 元素上的原始 style.display 属性值，这主要是为了应对用户在元素上设置了 display 属性，
    // 并且设置的属性值不是 'none' 的情况，例如设置了 block，当 v-show 为 true 的话，需要将 el.style.display 设置为 block。
    //
    // 需要特别注意的是，如果 el 元素上的原始 style.display 是 'none' 的话，则视为 '' 空字符串
    // 这是因为当 v-show 为 true 的话，vue 会将 el.style.display 设置为 originalDisplay，如果不将 'none' 视为 '' 的话，
    // 会出现 v-show 为 true，而 el.style.display 的值为 'none' 的情况，这是完全本末倒置的。
    const originalDisplay = el.__vOriginalDisplay =
      el.style.display === 'none' ? '' : el.style.display
    // 如果绑定了 v-show 指令的元素外层套了一层 transition 的话，则进入该分支
    // 该情况先不讨论，等后续分析 transition 源码的时候再回来说这部分内容
    if (value && transition) {
      vnode.data.show = true
      enter(vnode, () => {
        el.style.display = originalDisplay
      })
    } else {
      // 如果 el 外层没有嵌套 transition 的话，则进入该分支
      //
      // 如果 v-show 后面的表达式值为 true 的话，则 el.style.display = originalDisplay；
      // 如果 v-show 后面的表达式值为 false 的话，则 el.style.display = 'none';
      el.style.display = value ? originalDisplay : 'none'
    }
  },
  // 组件重新渲染时，如果进行对比的 vnode 和 oldVNode 都使用了 v-show 指令的话，触发执行 update
  update (el: any, { value, oldValue }: VNodeDirective, vnode: VNodeWithData) {
    // 如果 v-show 后面表达式的新值和旧值一样的话，则不需要进行任何处理，直接 return 即可
    if (value === oldValue) return
    vnode = locateNode(vnode)
    const transition = vnode.data && vnode.data.transition
    // 该分支先不讨论，等后续分析 transition 源码的时候再回来说这部分内容
    if (transition) {
      vnode.data.show = true
      if (value) {
        enter(vnode, () => {
          el.style.display = el.__vOriginalDisplay
        })
      } else {
        leave(vnode, () => {
          el.style.display = 'none'
        })
      }
    } else {
      // 如果 el 外层没有嵌套 transition 的话，则进入该分支
      // 这部分的逻辑和上面 bind 中的是一样的：
      // 如果 v-show 后面的表达式值为 true 的话，则 el.style.display = el.__vOriginalDisplay；
      // 如果 v-show 后面的表达式值为 false 的话，则 el.style.display = 'none';
      el.style.display = value ? el.__vOriginalDisplay : 'none'
    }
  },
  // v-show 指令和元素解绑时调用（oldVNode 使用了 v-show 指令，而 vnode 没有使用 v-show 指令）
  unbind (
    el: any,
    binding: VNodeDirective,
    vnode: VNodeWithData,
    oldVnode: VNodeWithData,
    isDestroy: boolean
  ) {
    if (!isDestroy) {
      // 如果当前的元素没有被销毁的话，则将 el.style.display 设置为 style.display 初始值。
      el.style.display = el.__vOriginalDisplay
    }
    // 如果当前元素已经被销毁了的话，就不用了再做任何操作了
  }
}
