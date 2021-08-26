/* @flow */

import { isObject, isDef } from 'core/util/index'

/**
 * Runtime helper for rendering v-for lists.
 */
export function renderList (
  val: any,
  render: (
    val: any,
    keyOrIndex: string | number,
    index?: number
  ) => VNode
): ?Array<VNode> {
  let ret: ?Array<VNode>, i, l, keys, key
  if (Array.isArray(val) || typeof val === 'string') {
    // 处理 val 是数组和字符串的情况，因为数组和字符串都能通过下标（data[index]）进行访问，所以将他们放在一起进行处理
    //
    // ret 是最终返回的数据，该数据是一个数组，因为 renderList 是生成 v-for 指令绑定元素的 vnode，
    // 所以最后的返回值一定是一个数组，并且数组的内容是 VNode。
    ret = new Array(val.length)
    // 开始遍历数组或者字符串
    for (i = 0, l = val.length; i < l; i++) {
      // render 函数的作用是：能够生成数据循环项所对应节点的 vnode。
      // 在这里调用 render 生成循环项对应节点的 vnode，并将生成的 vnode 赋值给 ret[i]
      ret[i] = render(val[i], i)
    }
  } else if (typeof val === 'number') {
    // 处理 val 是数字的情况，在 vue 中，遍历的数据还可以是数字类型的
    // 如果是数字类型的话，item 是：1、2、3 ... val
    //                   index 是：0、1、2、... val - 1
    ret = new Array(val)
    // 使用 for 遍历 0 -> val - 1
    for (i = 0; i < val; i++) {
      // 和上面一样，执行 render 函数生成循环项对应节点的 vnode，然后将 vnode 赋值给 ret[i]
      ret[i] = render(i + 1, i)
    }
  } else if (isObject(val)) {
    // 处理 val 是对象的情况，当 val 是对象类型时，v-for 可以写成 (value, name, index) in object
    // value 是对象键值对中的值；
    // name 是对象键值对中的键；
    // index 是当前处理键值对在所有键值对中的排序，从 0 开始；
    //
    // 获取 val 对象的键字符串数组
    keys = Object.keys(val)
    // 最终返回的数组，数组的长度是 val 对象中键值对的个数
    ret = new Array(keys.length)
    // 开始循环遍历键值的数组
    for (i = 0, l = keys.length; i < l; i++) {
      // 当前正在处理的键
      key = keys[i]
      // val[key] 当前正在处理键的值
      // 执行 render 函数生成循环项对应节点的 vnode，并将 vnode 赋值给 ret[i]
      ret[i] = render(val[key], key, i)
    }
  }
  if (isDef(ret)) {
    (ret: any)._isVList = true
  }
  // 返回生成好的 vnode 数组
  return ret
}
