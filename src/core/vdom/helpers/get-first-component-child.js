/* @flow */

import { isDef } from 'shared/util'
import { isAsyncPlaceholder } from './is-async-placeholder'

// 获取第一个组件子节点
export function getFirstComponentChild (children: ?Array<VNode>): ?VNode {
  if (Array.isArray(children)) {
    // 遍历 children 数组
    for (let i = 0; i < children.length; i++) {
      // 获取当前遍历的 children vnode
      const c = children[i]
      // 如果当前遍历的 vnode 存在，并且是组件 vnode 的话，则返回当前遍历的 vnode
      if (isDef(c) && (isDef(c.componentOptions) || isAsyncPlaceholder(c))) {
        return c
      }
    }
  }
}
