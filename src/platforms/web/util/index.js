/* @flow */

import { warn } from 'core/util/index'

export * from './attrs'
export * from './class'
export * from './element'

/**
 * 如果传入的 el 不是一个 DOM 元素的话，使用 DOM 查询或者创建一个 DOM 元素返回
 * el 只有两种类型，字符串或者 Element
 */
export function query (el: string | Element): Element {
  //如果 el 是一个字符串的话
  if (typeof el === 'string') {
    // 使用 document.querySelector 查询到这个 DOM 元素
    const selected = document.querySelector(el)
    // 如果没有指定选择器的元素的话
    if (!selected) {
      // 如果是生产环境的话，打印出警报
      process.env.NODE_ENV !== 'production' && warn(
        'Cannot find element: ' + el
      )
      // 使用 createElement 创建并返回 div 元素与
      return document.createElement('div')
    }
    // 返回查询到的 DOM 元素
    return selected
  } else {
    // 如果传递进来的 el 就是一个 DOM 元素的话，直接将其返回
    return el
  }
}
