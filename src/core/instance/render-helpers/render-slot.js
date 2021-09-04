/* @flow */

import { extend, warn, isObject } from 'core/util/index'

/**
 * Runtime helper for rendering <slot>
 */
export function renderSlot (
  name: string,
  fallback: ?Array<VNode>,
  props: ?Object,
  bindObject: ?Object
): ?Array<VNode> {
  // 从 vm.$scopedSlots 中获取指定插槽对应的函数，在这里 name = "default"
  const scopedSlotFn = this.$scopedSlots[name]
  if (scopedSlotFn) { // scoped slot
    // 作用域插槽 代码执行到这里
    props = props || {}

    if (bindObject) {
      if (process.env.NODE_ENV !== 'production' && !isObject(bindObject)) {
        warn(
          'slot v-bind without argument expects an Object',
          this
        )
      }
      props = extend(extend({}, bindObject), props)
    }
    // 将 props 作为参数执行 scopedSlotFn 函数，并将函数的返回值 return 出去
    // scopedSlotFn 函数的作用是创建并返回作用域插槽中节点的 vnode。
    return scopedSlotFn(props) || fallback
  } else {
    // 从 this.$slots 对象中获取指定插槽的数组，在这里 name == "default"
    const slotNodes = this.$slots[name]
    // warn duplicate slot usage
    if (slotNodes && process.env.NODE_ENV !== 'production') {
      slotNodes._rendered && warn(
        `Duplicate presence of slot "${name}" found in the same render tree ` +
        `- this will likely cause render errors.`,
        this
      )
      slotNodes._rendered = true
    }
    // 将 slotNodes 返回，如果 slotNodes 不存在的话，则返回 fallback
    // fallback 是 VNode 节点的数组，是当前处理 <slot> 的后备内容
    return slotNodes || fallback
  }
}
