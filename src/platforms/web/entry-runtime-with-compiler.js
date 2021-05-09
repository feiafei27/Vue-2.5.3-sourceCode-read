/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { shouldDecodeNewlines } from './util/compat'
import { compileToFunctions } from './compiler/index'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

// 当前的版本是 compiler 加上 runtime 的完整版,

// 这里的 Vue 是从 './runtime/index' 中导入的，在 './runtime/index' 中，Vue.prototype 中就已经定义了 $mount
// 这个已经定义了的 $mount 是适用于运行时环境的 $mount

// 而当前的版本是 compiler 加上 runtime 的完整版,所以在这里，取到这个 './runtime/index' 中已经了的 $mount
// 然后在下面定义的 $mount 函数的最后执行这个 mount 就可以了
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  // 根据 el 获取其对应的 DOM 元素
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    // 如果是在开发环境下，并且 el 元素是 <html> 或者 <body> 的话，在此打印出警告
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  // 拿到 new Vue() 传递的配置对象
  const options = this.$options
  // 判断配置对象中有没有写 render 函数，如果没有定义 render 的话，接下来会根据提供的 template 或者 el
  // 生成 render 函数，并赋值给 options
  // 也就是说：最终 Vue 只认 render 函数，如果用户定义了 render 函数的话，那就直接使用，如果没有定义的话，Vue 会为其生成
  if (!options.render) {
    // 判断配置对象中有没有 template
    let template = options.template
    if (template) {
      if (typeof template === 'string') {
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      } else if (template.nodeType) {
        template = template.innerHTML
      } else {
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      // 如果 template 是一个 DOM 节点的话，使用 innerHTML 属性获取该 DOM 节点的字符串形式
      template = getOuterHTML(el)
    }

    // 到这里，我们获取到了 template
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      const { render, staticRenderFns } = compileToFunctions(template, {
        shouldDecodeNewlines,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  // 在确保 options 中有 render 函数之后，就开始执行 runtime 中挂载的 $mount 进行渲染
  // 也就是说：（1）entry-runtime-with-compiler 中的 $mount 负责编译的工作，最终的处理结果就是 options 中一定会有用于渲染的 render 函数
  //          （2）而 runtime 中的 $mount 函数则负责根据生成的 render 函数进行页面的渲染
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML (el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
