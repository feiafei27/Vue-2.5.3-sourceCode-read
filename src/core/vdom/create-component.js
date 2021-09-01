/* @flow */

import VNode from './vnode'
import { resolveConstructorOptions } from 'core/instance/init'
import { queueActivatedComponent } from 'core/observer/scheduler'
import { createFunctionalComponent } from './create-functional-component'

import {
  warn,
  isDef,
  isUndef,
  isTrue,
  isObject
} from '../util/index'

import {
  resolveAsyncComponent,
  createAsyncPlaceholder,
  extractPropsFromVNodeData
} from './helpers/index'

import {
  callHook,
  activeInstance,
  updateChildComponent,
  activateChildComponent,
  deactivateChildComponent
} from '../instance/lifecycle'

// hooks to be invoked on component VNodes during patch
const componentVNodeHooks = {
  init (
    vnode: VNodeWithData,
    hydrating: boolean,
    parentElm: ?Node,
    refElm: ?Node
  ): ?boolean {
    if (!vnode.componentInstance || vnode.componentInstance._isDestroyed) {
      const child = vnode.componentInstance = createComponentInstanceForVnode(
        vnode,
        activeInstance,
        parentElm,
        refElm
      )
      child.$mount(hydrating ? vnode.elm : undefined, hydrating)
    } else if (vnode.data.keepAlive) {
      // kept-alive components, treat as a patch
      const mountedNode: any = vnode // work around flow
      componentVNodeHooks.prepatch(mountedNode, mountedNode)
    }
  },

  prepatch (oldVnode: MountedComponentVNode, vnode: MountedComponentVNode) {
    const options = vnode.componentOptions
    const child = vnode.componentInstance = oldVnode.componentInstance
    updateChildComponent(
      child,
      options.propsData, // updated props
      options.listeners, // updated listeners
      vnode, // new parent vnode
      options.children // new children
    )
  },

  insert (vnode: MountedComponentVNode) {
    const { context, componentInstance } = vnode
    if (!componentInstance._isMounted) {
      componentInstance._isMounted = true
      callHook(componentInstance, 'mounted')
    }
    if (vnode.data.keepAlive) {
      if (context._isMounted) {
        // vue-router#1212
        // During updates, a kept-alive component's child components may
        // change, so directly walking the tree here may call activated hooks
        // on incorrect children. Instead we push them into a queue which will
        // be processed after the whole patch process ended.
        queueActivatedComponent(componentInstance)
      } else {
        activateChildComponent(componentInstance, true /* direct */)
      }
    }
  },

  destroy (vnode: MountedComponentVNode) {
    const { componentInstance } = vnode
    if (!componentInstance._isDestroyed) {
      if (!vnode.data.keepAlive) {
        componentInstance.$destroy()
      } else {
        deactivateChildComponent(componentInstance, true /* direct */)
      }
    }
  }
}

// [ 'init', 'prepatch', 'insert', 'destroy' ]
const hooksToMerge = Object.keys(componentVNodeHooks)

// 创建组件的 vnode
export function createComponent (
  Ctor: Class<Component> | Function | Object | void,
  data: ?VNodeData,
  context: Component,
  children: ?Array<VNode>,
  tag?: string
): VNode | void {
  if (isUndef(Ctor)) {
    return
  }

  // 获取 vm.$options._base
  // 在 global-api/index.js 中，有这么一行代码：Vue.options._base = Vue
  // 然后在 vm 初始化的过程中，Vue.options 会和 vm 的 options 进行合并
  // 所以在这里：baseCtor = Vue 这个构造函数
  const baseCtor = context.$options._base

  // plain options object: turn it into a constructor
  // 如果 Ctor 是一个 对象类型的话
  if (isObject(Ctor)) {
    // 借助 Vue.extend（Vue.extend 的具体用法可以看官网的api）将 Ctor 对象转换成 Vue 构造器的子类
    Ctor = baseCtor.extend(Ctor)
  }

  // if at this stage it's not a constructor or an async component factory,
  // reject.
  // 如果代码执行到这里，Ctor 不是一个组件的构造函数，不是一个异步的组件工厂方法的话，在下面打印出警告
  if (typeof Ctor !== 'function') {
    if (process.env.NODE_ENV !== 'production') {
      warn(`Invalid Component definition: ${String(Ctor)}`, context)
    }
    return
  }

  // 异步组件的处理
  let asyncFactory
  // 下面的 if 代码块是处理异步组件的逻辑
  if (isUndef(Ctor.cid)) {
    asyncFactory = Ctor
    Ctor = resolveAsyncComponent(asyncFactory, baseCtor, context)
    if (Ctor === undefined) {
      // 返回一个占位用的 VNode，将会被渲染成一个注释节点。
      // 但是这个 VNode 保留了渲染这个异步组件所需的所有信息数据
      return createAsyncPlaceholder(
        asyncFactory,
        data,
        context,
        children,
        tag
      )
    }
  }

  data = data || {}

  // 对 options 再做一些处理，因为有可能被全局的 mixins 所影响
  resolveConstructorOptions(Ctor)

  // 对组件 v-model 的处理
  if (isDef(data.model)) {
    transformModel(Ctor.options, data)
  }

  // extract props
  const propsData = extractPropsFromVNodeData(data, Ctor, tag)

  // 对函数式组件的处理
  if (isTrue(Ctor.options.functional)) {
    return createFunctionalComponent(Ctor, propsData, data, context, children)
  }

  // extract listeners, since these needs to be treated as
  // child component listeners instead of DOM listeners
  // 组件自定义事件的处理
  const listeners = data.on
  // replace with listeners with .native modifier
  // so it gets processed during parent component patch.
  data.on = data.nativeOn

  if (isTrue(Ctor.options.abstract)) {
    // abstract components do not keep anything
    // other than props & listeners & slot

    // work around flow
    const slot = data.slot
    data = {}
    if (slot) {
      data.slot = slot
    }
  }

  // 安装组件的钩子函数
  mergeHooks(data)

  // return a placeholder vnode
  const name = Ctor.options.name || tag
  // 借助 VNode 类创建 vnode，并返回
  const vnode = new VNode(
    // 组件 VNode 的 tag 以 'vue-component-' 开头，这是很重要的标识
    `vue-component-${Ctor.cid}${name ? `-${name}` : ''}`,
    data,
    // 组件 VNode 的 children、text 和 elm 都是空
    undefined, undefined, undefined,
    context,
    // 创建组件 VNode 时，参数是通过 componentOptions 来传递的
    // 包括 children，组件的 children 在插槽的功能中会用到
    { Ctor, propsData, listeners, tag, children },
    asyncFactory
  )

  return vnode
}

export function createComponentInstanceForVnode (
  vnode: any, // we know it's MountedComponentVNode but flow doesn't
  parent: any, // activeInstance in lifecycle state
  parentElm?: ?Node,
  refElm?: ?Node
): Component {
  const vnodeComponentOptions = vnode.componentOptions
  // options 是创建组件 vue 实例的参数对象
  const options: InternalComponentOptions = {
    _isComponent: true,
    parent,
    propsData: vnodeComponentOptions.propsData,
    _componentTag: vnodeComponentOptions.tag,
    _parentVnode: vnode,
    // 将 vnode.componentOptions.listeners 赋值到 options._parentListeners
    _parentListeners: vnodeComponentOptions.listeners,
    _renderChildren: vnodeComponentOptions.children,
    _parentElm: parentElm || null,
    _refElm: refElm || null
  }
  // check inline-template render functions
  const inlineTemplate = vnode.data.inlineTemplate
  if (isDef(inlineTemplate)) {
    options.render = inlineTemplate.render
    options.staticRenderFns = inlineTemplate.staticRenderFns
  }
  // 创建组件对应的 vue 实例，并且以 options 为参数
  return new vnodeComponentOptions.Ctor(options)
}

// 将 componentVNodeHooks 中的钩子函数合并到 data.hook
function mergeHooks (data: VNodeData) {
  if (!data.hook) {
    data.hook = {}
  }
  // hooksToMerge = [ 'init', 'prepatch', 'insert', 'destroy' ]
  // 遍历 componentVNodeHooks 中的钩子函数的 keys
  for (let i = 0; i < hooksToMerge.length; i++) {
    const key = hooksToMerge[i]
    // 拿到用户自定义的钩子函数和componentVNodeHooks中的构造函数
    const fromParent = data.hook[key]
    const ours = componentVNodeHooks[key]
    // 对两种构造函数进行合并
    data.hook[key] = fromParent ? mergeHook(ours, fromParent) : ours
  }
}

// 对两个同种的构造函数进行合并
// 合并的方式也很简单，然后一个包装函数，在包装函数中一次执行这两个钩子函数
function mergeHook (one: Function, two: Function): Function {
  return function (a, b, c, d) {
    one(a, b, c, d)
    two(a, b, c, d)
  }
}

// 该函数用于处理 v-model 特性
function transformModel (options, data: any) {
  // 这里用于实现自定义组件中的 model 选项，可以自定义组件上的 v-model 被解析成的 prop 和 event
  //
  // 这里的 options 是自定义组件的配置对象，在这里，判断该组件有没有配置 model 选项，如果配置了的话，
  // 再判断 model 选项中有没有配置 prop 和 event，如果也配置了的话，则取配置的 prop 和 event 作为
  // v-model 会被解析的 prop 和 event。
  // 如果没有配置的话，则 v-model 默认解析成 'value' prop 和 'input' event。
  const prop = (options.model && options.model.prop) || 'value'
  const event = (options.model && options.model.event) || 'input'

  // 将 v-model 指定的值赋值到 data.props[prop] 中
  // 例如 v-model="message"，message = 'hello'，则在这里，默认情况下，data.props.value = 'hello'
  ;(data.props || (data.props = {}))[prop] = data.model.value

  // 将 v-model 对应的事件回调函数保存到 data.on[event] 中
  const on = data.on || (data.on = {})
  // 因为 event 事件有可能已经存在，所以需要额外的处理
  if (isDef(on[event])) {
    // 如果 event 事件已经存在的话，则将 data.on[event] 的属性值变成一个数组，数组中保存该事件所有的回调函数
    on[event] = [data.model.callback].concat(on[event])
  } else {
    // 如果 event 还不存在的话，直接将 data.model.callback 赋值给 data.on[event] 即可
    on[event] = data.model.callback
  }
}
