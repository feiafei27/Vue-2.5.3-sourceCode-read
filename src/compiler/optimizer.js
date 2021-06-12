/* @flow */

import { makeMap, isBuiltInTag, cached, no } from 'shared/util'

let isStaticKey
let isPlatformReservedTag

const genStaticKeysCached = cached(genStaticKeys)

/**
 * Goal of the optimizer: walk the generated template AST tree
 * and detect sub-trees that are purely static, i.e. parts of
 * the DOM that never needs to change.
 *
 * Once we detect these sub-trees, we can:
 *
 * 1. Hoist them into constants, so that we no longer need to
 *    create fresh nodes for them on each re-render;
 * 2. Completely skip them in the patching process.
 */
export function optimize (root: ?ASTElement, options: CompilerOptions) {
  if (!root) return
  isStaticKey = genStaticKeysCached(options.staticKeys || '')
  isPlatformReservedTag = options.isReservedTag || no
  // first pass: mark all non-static nodes.
  // 第一步：标记静态节点
  markStatic(root)
  // second pass: mark static roots.
  // 第二部：标记静态根节点
  markStaticRoots(root, false)
}

function genStaticKeys (keys: string): Function {
  return makeMap(
    'type,tag,attrsList,attrsMap,plain,parent,children,attrs' +
    (keys ? ',' + keys : '')
  )
}

// 标记所有的静态节点（从根节点向下）
function markStatic (node: ASTNode) {
  // isStatic 判断某一个节点是不是静态节点
  node.static = isStatic(node)
  if (node.type === 1) {
    // 对子节点进行静态节点标志的处理，因为只有元素节点才有子节点，所以用 if (node.type === 1) 进行判断
    // do not make component slot content static. this avoids
    // 1. components not able to mutate slot nodes
    // 2. static slot content fails for hot-reloading
    // 不要将自定义组件标记为静态节点，所以在这里，直接 return
    if (
      !isPlatformReservedTag(node.tag) &&
      node.tag !== 'slot' &&
      node.attrsMap['inline-template'] == null
    ) {
      return
    }
    // 对子节点遍历执行 markStatic 函数，
    for (let i = 0, l = node.children.length; i < l; i++) {
      const child = node.children[i]
      markStatic(child)
      if (!child.static) {
        // 如果有一个子节点不是静态节点的话，那么其父节点就肯定不是静态节点
        node.static = false
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        const block = node.ifConditions[i].block
        markStatic(block)
        if (!block.static) {
          // 如果有一个子节点不是静态节点的话，那么其父节点就肯定不是静态节点
          node.static = false
        }
      }
    }
  }
}

// 标记静态根节点
function markStaticRoots (node: ASTNode, isInFor: boolean) {
  if (node.type === 1) {
    if (node.static || node.once) {
      node.staticInFor = isInFor
    }
    // For a node to qualify as a static root, it should have children that
    // are not just static text. Otherwise the cost of hoisting out will
    // outweigh the benefits and it's better off to just always render it fresh.
    // 如果当前节点是静态节点，且该节点有子节点，并且这个子节点不是单一的文本节点的话，
    // 就将当前的节点标记为静态根节点
    if (node.static && node.children.length && !(
      node.children.length === 1 &&
      node.children[0].type === 3
    )) {
      node.staticRoot = true
      return
    } else {
      node.staticRoot = false
    }
    // 递归调用子节点
    if (node.children) {
      for (let i = 0, l = node.children.length; i < l; i++) {
        markStaticRoots(node.children[i], isInFor || !!node.for)
      }
    }
    if (node.ifConditions) {
      for (let i = 1, l = node.ifConditions.length; i < l; i++) {
        markStaticRoots(node.ifConditions[i].block, isInFor)
      }
    }
  }
}

// 判断某一个节点是不是静态节点
function isStatic (node: ASTNode): boolean {
  // AST type 解释
  // 1：元素节点
  // 2：含有表达式的文本节点
  // 3：纯文本节点
  if (node.type === 2) { // expression
    // 如果是含有表达式的文本节点的话，肯定不是静态节点
    return false
  }
  if (node.type === 3) { // text
    // 如果是纯文本节点的话，肯定是静态节点
    return true
  }
  // 剩下的就是判断元素节点是不是静态节点
  // 元素节点的判断稍微复杂一些，有很多种情况
  // 一：如果该节点有 v-pre 指令的话，一定是静态节点。
  // 二：如果该节点没有 v-pre 指令的话，则必须满足一系列的条件才能是静态节点。
  //     (1)不能绑定动态数据
  //     (2)不能有 v-if 和 v-for 指令
  //     (3)不能是内建组件(slot、component)
  //     (4)必须是平台上面的标签，例如：web 端的 div、p等等。
  //     (5)不能是有 v-for 指令节点的子节点,
  //     (6)node 中的 key 必须都是静态的 key(type、tag、attrsList、parent、children....)，不能有额外的 key
  return !!(node.pre || (
    !node.hasBindings && // no dynamic bindings
    !node.if && !node.for && // not v-if or v-for or v-else
    !isBuiltInTag(node.tag) && // not a built-in
    isPlatformReservedTag(node.tag) && // not a component
    !isDirectChildOfTemplateFor(node) &&
    Object.keys(node).every(isStaticKey)
  ))
}

function isDirectChildOfTemplateFor (node: ASTElement): boolean {
  while (node.parent) {
    node = node.parent
    if (node.tag !== 'template') {
      return false
    }
    if (node.for) {
      return true
    }
  }
  return false
}
