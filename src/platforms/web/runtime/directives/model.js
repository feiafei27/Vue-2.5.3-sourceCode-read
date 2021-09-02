/**
 * Not type checking this file because flow doesn't like attaching
 * properties to Elements.
 */

import { isTextInputType } from 'web/util/element'
import { looseEqual, looseIndexOf } from 'shared/util'
import { warn, isAndroid, isIE9, isIE, isEdge } from 'core/util/index'

/* istanbul ignore if */
if (isIE9) {
  // http://www.matts411.com/post/internet-explorer-9-oninput/
  document.addEventListener('selectionchange', () => {
    const el = document.activeElement
    if (el && el.vmodel) {
      trigger(el, 'input')
    }
  })
}

export default {
  inserted (el, binding, vnode) {
    if (vnode.tag === 'select') {
      setSelected(el, binding, vnode.context)
      el._vOptions = [].map.call(el.options, getValue)
    } else if (vnode.tag === 'textarea' || isTextInputType(el.type)) {
      // 看这个分支
      el._vModifiers = binding.modifiers
      if (!binding.modifiers.lazy) {
        el.addEventListener('change', onCompositionEnd)
        if (!isAndroid) {
          // compositionstart 事件触发时，调用 onCompositionStart 函数，
          // 将 e.target.composing 设为 true
          el.addEventListener('compositionstart', onCompositionStart)
          // compositionend 事件触发时，调用 onCompositionEnd 函数，
          // 将 e.target.composing 设为 false，并且用代码触发 input 元素的 input 事件
          // 这会触发执行 v-model 指令所翻译成的 input 回调函数，在这个回调函数中，更新状态
          el.addEventListener('compositionend', onCompositionEnd)
          // 通过上面两个事件及回调函数，就可以保证在输入拼音字符的过程中，v-model 对应的状态不被改变，
          // 这是因为在输入拼音字符的过程中，$event.target.composing 为 true，
          // 只有当拼音输入完毕之后，$event.target.composing 才为 false
        }
        /* istanbul ignore if */
        if (isIE9) {
          el.vmodel = true
        }
      }
    }
  },
  componentUpdated (el, binding, vnode) {
    if (vnode.tag === 'select') {
      setSelected(el, binding, vnode.context)
      // in case the options rendered by v-for have changed,
      // it's possible that the value is out-of-sync with the rendered options.
      // detect such cases and filter out values that no longer has a matching
      // option in the DOM.
      const prevOptions = el._vOptions
      const curOptions = el._vOptions = [].map.call(el.options, getValue)
      if (curOptions.some((o, i) => !looseEqual(o, prevOptions[i]))) {
        // trigger change event if
        // no matching option found for at least one value
        const needReset = el.multiple
          ? binding.value.some(v => hasNoMatchingOption(v, curOptions))
          : binding.value !== binding.oldValue && hasNoMatchingOption(binding.value, curOptions)
        if (needReset) {
          trigger(el, 'change')
        }
      }
    }
  }
}

function onCompositionStart (e) {
  // 将 e.target.composing 属性设置为 true
  e.target.composing = true
}
function onCompositionEnd (e) {
  // prevent triggering an input event for no reason
  if (!e.target.composing) return
  // 将 e.target.composing 属性设置为 true
  e.target.composing = false
  // 用代码触发 input 事件
  trigger(e.target, 'input')
}
// 触发事件的工具函数
function trigger (el, type) {
  const e = document.createEvent('HTMLEvents')
  e.initEvent(type, true, true)
  el.dispatchEvent(e)
}
////////////////////////////////////////////////////////////////////
function setSelected (el, binding, vm) {
  actuallySetSelected(el, binding, vm)
  /* istanbul ignore if */
  if (isIE || isEdge) {
    setTimeout(() => {
      actuallySetSelected(el, binding, vm)
    }, 0)
  }
}
function actuallySetSelected (el, binding, vm) {
  const value = binding.value
  const isMultiple = el.multiple
  if (isMultiple && !Array.isArray(value)) {
    process.env.NODE_ENV !== 'production' && warn(
      `<select multiple v-model="${binding.expression}"> ` +
      `expects an Array value for its binding, but got ${
        Object.prototype.toString.call(value).slice(8, -1)
      }`,
      vm
    )
    return
  }
  let selected, option
  for (let i = 0, l = el.options.length; i < l; i++) {
    option = el.options[i]
    if (isMultiple) {
      selected = looseIndexOf(value, getValue(option)) > -1
      if (option.selected !== selected) {
        option.selected = selected
      }
    } else {
      if (looseEqual(getValue(option), value)) {
        if (el.selectedIndex !== i) {
          el.selectedIndex = i
        }
        return
      }
    }
  }
  if (!isMultiple) {
    el.selectedIndex = -1
  }
}
function hasNoMatchingOption (value, options) {
  return options.every(o => !looseEqual(o, value))
}
function getValue (option) {
  return '_value' in option
    ? option._value
    : option.value
}
