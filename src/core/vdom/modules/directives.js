/* @flow */

import { emptyNode } from 'core/vdom/patch'
import { resolveAsset, handleError } from 'core/util/index'
import { mergeVNodeHook } from 'core/vdom/helpers/index'

export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives (vnode: VNodeWithData) {
    updateDirectives(vnode, emptyNode)
  }
}

function updateDirectives (oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode)
  }
}

function _update (oldVnode, vnode) {
  // 判断 vnode 是不是一个新建的节点
  const isCreate = oldVnode === emptyNode
  // 判断当前的处理，vnode 是不是被销毁移除
  const isDestroy = vnode === emptyNode
  // oldVnode 中的指令集合
  // 是一个对象，结构如下所示：
  // {
  //   v-focus: {
  //     def: {inserted: f},
  //     modifiers: {},
  //     name: "focus",
  //     rawName: "v-focus"
  //   }
  // }
  const oldDirs = normalizeDirectives(oldVnode.data.directives, oldVnode.context)
  // vnode 中的指令集合，也是一个对象
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context)

  // 保存需要触发 inserted 指令钩子函数的指令列表
  const dirsWithInsert = []
  // 保存需要触发 componentUpdated 指令钩子函数的指令列表
  const dirsWithPostpatch = []

  // 接下来要做的事情是对比 newDirs 和 oldDirs 两个指令集合并触发执行对应的钩子函数
  let key, oldDir, dir
  // 使用 for in 遍历 newDirs
  for (key in newDirs) {
    // 使用遍历对象的 key 从 oldDirs 和 newDirs 中获取 oldDir 和 dir
    oldDir = oldDirs[key]
    dir = newDirs[key]
    if (!oldDir) {
      // 如果 oldDir 不存在的话，说明当前循环的指令是首次绑定到元素
      // 此时需要触发执行 dir 指令中的 bind 函数
      callHook(dir, 'bind', vnode, oldVnode)
      // 如果 dir 指令中存在 inserted 方法的话，那么该指令将被添加到 dirsWithInsert 数组中，
      // 稍后再触发执行这些 inserted 方法，这样做的目的是：执行完所有的 bind 方法后，再执行 inserted 方法
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir)
      }
    } else {
      // 如果 oldDir 存在的话，说明当前的指令已经被绑定过了，此时应该执行 dir 中的 update 方法
      dir.oldValue = oldDir.value
      // 触发执行 dir 中的 update 方法
      callHook(dir, 'update', vnode, oldVnode)
      // 判断 dir 中有没有定义 componentUpdated 方法，如果定义了的话，将其添加到 dirsWithPostpatch 数组中
      // 这样做的目的是保证：指令所在组件的 VNode 及其子 VNode 全部更新后调用
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir)
      }
    }
  }

  // 处理 inserted 方法
  if (dirsWithInsert.length) {
    // 创建一个新的函数 callInsert，在该函数中，真正的触发执行 inserted 方法，
    // 确保触发执行 inserted 方法是在被绑定元素插入到父节点之后。
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], 'inserted', vnode, oldVnode)
      }
    }
    // isCreate 用于判断 vnode 是不是一个新建的节点
    if (isCreate) {
      // 如果 vnode 是新创建的节点，那么就应该等到元素被插入到父节点之后再触发执行指令的 inserted 方法
      // 在这里，通过 mergeVNodeHook 将 callInsert 添加到虚拟节点的 insert 钩子函数列表中，将 inserted 方法
      // 的执行推迟到元素插入到父节点之后
      mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'insert', callInsert)
    } else {
      // 如果被绑定元素已经被插入到父节点，则直接触发执行 callInsert 函数
      callInsert()
    }
  }

  // 处理 componentUpdated 方法
  if (dirsWithPostpatch.length) {
    // 这里和上面的 inserted 同理。
    // dir 中的 componentUpdated 方法需要在指令所在组件的 VNode 及其子 VNode 全部更新之后触发执行
    mergeVNodeHook(vnode.data.hook || (vnode.data.hook = {}), 'postpatch', () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], 'componentUpdated', vnode, oldVnode)
      }
    })
  }

  // 处理 unbind 方法
  if (!isCreate) {
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // 如果 oldDirs 中的指令在 newDirs 中不存在的话，则触发执行 oldDirs[key] 中的 unbind 方法
        callHook(oldDirs[key], 'unbind', oldVnode, oldVnode, isDestroy)
      }
    }
  }
}

const emptyModifiers = Object.create(null)

// 将 vnode 中使用的指令从用户注册的自定义指令集合中取出
function normalizeDirectives (
  dirs: ?Array<VNodeDirective>,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null)
  if (!dirs) {
    return res
  }
  let i, dir
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i]
    if (!dir.modifiers) {
      dir.modifiers = emptyModifiers
    }
    res[getRawDirName(dir)] = dir
    dir.def = resolveAsset(vm.$options, 'directives', dir.name, true)
  }
  return res
}

function getRawDirName (dir: VNodeDirective): string {
  return dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join('.')}`
}

// 调用情形例如：callHook(dir, 'bind', vnode, oldVnode)，dir 对象的结构如下所示：
// {
//   def: {bind: f},
//   modifiers: {},
//   name: "focus",
//   rawName: "v-focus"
// }
function callHook (dir, hook, vnode, oldVnode, isDestroy) {
  // 获取 dir 指令中指定的 hook 函数，然后触发执行
  const fn = dir.def && dir.def[hook]
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy)
    } catch (e) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`)
    }
  }
}
