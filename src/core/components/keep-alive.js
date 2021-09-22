/* @flow */

import { isRegExp, remove } from 'shared/util'
import { getFirstComponentChild } from 'core/vdom/helpers/index'

type VNodeCache = { [key: string]: ?VNode };

function getComponentName (opts: ?VNodeComponentOptions): ?string {
  return opts && (opts.Ctor.options.name || opts.tag)
}

function matches (pattern: string | RegExp | Array<string>, name: string): boolean {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  /* istanbul ignore next */
  return false
}

function pruneCache (keepAliveInstance: any, filter: Function) {
  const { cache, keys, _vnode } = keepAliveInstance
  for (const key in cache) {
    const cachedNode: ?VNode = cache[key]
    if (cachedNode) {
      const name: ?string = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

// 该方法用于移除 cache 中缓存的指定 vnode
function pruneCacheEntry (
  // 用于缓存 vnode 的对象
  cache: VNodeCache,
  // 当前要移除 vnode 的 key
  key: string,
  // 已缓存 vnode 的 key 集合
  keys: Array<string>,
  // keep-alive 内当前渲染组件的 vnode
  current?: VNode
) {
  const cached = cache[key]
  if (cached && cached !== current) {
    cached.componentInstance.$destroy()
  }
  cache[key] = null
  remove(keys, key)
}

const patternTypes: Array<Function> = [String, RegExp, Array]

export default {
  name: 'keep-alive',
  // keep-alive 是一个抽象组件，抽象组件不会渲染成 DOM 元素，也不会出现在父组件链中
  abstract: true,

  props: {
    // 缓存白名单
    // 字符串或正则表达式。只有名称匹配的组件会被缓存。
    include: patternTypes,
    // 缓存黑名单
    // 字符串或正则表达式。任何名称匹配的组件都不会被缓存。
    exclude: patternTypes,
    // 数字。最多可以缓存多少组件实例。
    max: [String, Number]
  },

  created () {
    // 用于缓存 vnode 的对象
    this.cache = Object.create(null)
    // 已缓存的 vnode 的 key 集合
    this.keys = []
  },

  destroyed () {
    // 清空所有缓存的 vnode
    // 使用 for in 遍历 this.cache 对象
    for (const key in this.cache) {
      // 借助 pruneCacheEntry 方法移除缓存的 vnode
      pruneCacheEntry(this.cache, key, this.keys)
    }
  },

  watch: {
    include (val: string | RegExp | Array<string>) {
      pruneCache(this, name => matches(val, name))
    },
    exclude (val: string | RegExp | Array<string>) {
      pruneCache(this, name => !matches(val, name))
    }
  },

  render () {
    const vnode: VNode = getFirstComponentChild(this.$slots.default)
    const componentOptions: ?VNodeComponentOptions = vnode && vnode.componentOptions
    if (componentOptions) {
      // check pattern
      const name: ?string = getComponentName(componentOptions)
      if (name && (
        (this.include && !matches(this.include, name)) ||
        (this.exclude && matches(this.exclude, name))
      )) {
        return vnode
      }

      const { cache, keys } = this
      const key: ?string = vnode.key == null
        // same constructor may get registered as different local components
        // so cid alone is not enough (#3269)
        ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
        : vnode.key
      if (cache[key]) {
        vnode.componentInstance = cache[key].componentInstance
        // make current key freshest
        remove(keys, key)
        keys.push(key)
      } else {
        cache[key] = vnode
        keys.push(key)
        // prune oldest entry
        if (this.max && keys.length > parseInt(this.max)) {
          pruneCacheEntry(cache, keys[0], keys, this._vnode)
        }
      }

      vnode.data.keepAlive = true
    }
    return vnode
  }
}
