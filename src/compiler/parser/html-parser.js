/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'

// 定义一些用于解析模板字符串的正则表达式
// Regular Expressions for parsing tags and attributes
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
// could use https://www.w3.org/TR/1999/REC-xml-names-19990114/#NT-QName
// but for Vue templates we can enforce a simple charset
const ncname = '[a-zA-Z_][\\w\\-\\.]*'
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
const startTagOpen = new RegExp(`^<${qnameCapture}`)
const startTagClose = /^\s*(\/?)>/
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
const doctype = /^<!DOCTYPE [^>]+>/i
const comment = /^<!--/
const conditionalComment = /^<!\[/

let IS_REGEX_CAPTURING_BROKEN = false
'x'.replace(/x(.)?/g, function (m, g) {
  IS_REGEX_CAPTURING_BROKEN = g === ''
})

// Special Elements (can contain anything)
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n'
}
const encodedAttr = /&(?:lt|gt|quot|amp);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#10);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

function decodeAttr (value, shouldDecodeNewlines) {
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  return value.replace(re, match => decodingMap[match])
}

export function parseHTML (html, options) {
  // 栈数据结构对于模板的解析很重要
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  // last 变量用于记录 html 字符串上一次解析之前的状态
  let last, lastTag

  // 解析 html 的过程，就是不断的截取和解析的过程，直至 html 字符串被解析完
  // 所以在这里，使用 while (html) 不断的遍历 html 字符串

  // 理解这部分内容，建议可以先写一个 html，然后将这个 html 代入下面的代码中进行理解分析。
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    // !lastTag 针对首次进入解析的状态
    // isPlainTextElement = makeMap('script,style,textarea', true)
    // !isPlainTextElement(lastTag) 针对上一个处理的 tag 不是 script、style、textarea 的情况下
    if (!lastTag || !isPlainTextElement(lastTag)) {
      // 获取当前的 html 中首个 '<' 的下标位置
      let textEnd = html.indexOf('<')
      // 如果 < 的下标是 0 的话，说明当前 html 字符串的开头是一个标签
      if (textEnd === 0) {
        // 接下来判断这个开头的标签是什么类型的标签
        // (1)使用 comment 正则表达式判断是不是注释标签
        // const comment = /^<!--/
        if (comment.test(html)) {
          // 获取注释节点结束标签的下标位置
          const commentEnd = html.indexOf('-->')

          // 如果 '-->' 存在的话，在进行下面的处理
          if (commentEnd >= 0) {
            // 在解析的配置对象中，shouldKeepComment 属性的作用是：决定是否保留注释节点
            if (options.shouldKeepComment) {
              // 如果为 true 的话，则调用 options 中的 comment 回调函数，添加该注释节点对应的 AST，参数是该注释节点的内容
              options.comment(html.substring(4, commentEnd))
            }
            // 调用 advance 将已经解析的内容截断掉
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        // 判断开头的标签是不是 <![if !IE]> 类型的
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            // 如果是 <![if !IE]> 标签的话，就什么都不用做，直接截取掉并跳过
            advance(conditionalEnd + 2)
            continue
          }
        }

        // 判断是不是 DOCTYPE 节点，如果是的话，也是直接截取掉并跳过
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        // 接下来就是比较重点的开始标签和结束标签的判断和处理
        // 对结束标签进行匹配和处理
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          // 如果当前的 html 开头是结束标签的话
          const curIndex = index
          // 截取掉匹配的结束标签
          advance(endTagMatch[0].length)
          // 对该结束标签进行处理
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // 对当前 html 的开始标签进行解析和处理
        // parseStartTag 函数能够返回解析后的开始标签的信息
        const startTagMatch = parseStartTag()
        if (startTagMatch) {
          // 如果当前 html 的开头的确是开始标签的话，则调用 handleStartTag 进行处理
          handleStartTag(startTagMatch)
          if (shouldIgnoreFirstNewline(lastTag, html)) {
            advance(1)
          }
          continue
        }
      }

      // 这一部分逻辑是处理标签内文本内容的
      let text, rest, next
      if (textEnd >= 0) {
        // 获取当前的 html 字符串除最前面的文本内容剩下的部分
        rest = html.slice(textEnd)
        ////////// 用于处理文本字符串中有 '<' 符号的情况 //////////
        // 计算出结束标签的 '<' 真正的位置
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        ////////// 用于处理文本字符串中有 '<' 符号的情况 //////////
        // 截取出当前需要处理的文本节点
        text = html.substring(0, textEnd)
        advance(textEnd)
      }

      // 处理找不到 '<' 的情况，将 html 置为 ''，外面的 while(html) 就会结束
      if (textEnd < 0) {
        text = html
        html = ''
      }

      if (options.chars && text) {
        // 调用 options 中的 chars 回调函数，创建该文本的 AST 节点
        options.chars(text)
      }
    } else {
      // 下面的代码针对上一个处理的 tag 是 script、style、textarea 的情况
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          text = text
            .replace(/<!--([\s\S]*?)-->/g, '$1')
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`)
      }
      break
    }
  }

  // Clean up any remaining tags
  parseEndTag()

  // 用于截取掉已经处理了的 html 内容
  function advance (n) {
    index += n
    html = html.substring(n)
  }

  function parseStartTag () {
    const start = html.match(startTagOpen)
    if (start) {
      const match = {
        tagName: start[1],
        attrs: [],
        start: index
      }
      advance(start[0].length)
      let end, attr
      while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
        advance(attr[0].length)
        match.attrs.push(attr)
      }
      if (end) {
        match.unarySlash = end[1]
        advance(end[0].length)
        match.end = index
        return match
      }
    }
  }

  function handleStartTag (match) {
    const tagName = match.tagName
    const unarySlash = match.unarySlash

    if (expectHTML) {
      // 如果用户将 phrase 标签放到 p 标签中的话，这是不合 w3c 规范的。
      // Vue 会将这个 div 标签提到 p 标签的后面，并且在后面加上一对空的 p 标签，例如：
      // <p>1111<div>2222</div></p> ==> <p>1111</p><div>2222</div><p></p>
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    // 判断是不是自闭和的标签
    const unary = isUnaryTag(tagName) || !!unarySlash

    const l = match.attrs.length
    const attrs = new Array(l)
    // 遍历处理标签的 attrs
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      // hackish work around FF bug https://bugzilla.mozilla.org/show_bug.cgi?id=369778
      if (IS_REGEX_CAPTURING_BROKEN && args[0].indexOf('""') === -1) {
        if (args[3] === '') { delete args[3] }
        if (args[4] === '') { delete args[4] }
        if (args[5] === '') { delete args[5] }
      }
      const value = args[3] || args[4] || args[5] || ''
      attrs[i] = {
        name: args[1],
        value: decodeAttr(
          value,
          options.shouldDecodeNewlines
        )
      }
    }

    // 如果当前标签不是自闭和标签的话，需要将当前标签的信息对象 push 到栈数组中。栈数组用于处理 html 中标签的父子关系
    if (!unary) {
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs })
      lastTag = tagName
    }

    if (options.start) {
      // 调用 options 中的 start 回调函数，生成该开始标签的 AST
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  function parseEndTag (tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    if (tagName) {
      // 统一转换成小写
      lowerCasedTagName = tagName.toLowerCase()
    }

    // Find the closest opened tag of the same type
    if (tagName) {
      // stack 栈从后往前找，寻找与 lowerCasedTagName 相同的标签的下标
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    // 如果在栈中找到了与 lowerCasedTagName 相同标签的话，
    if (pos >= 0) {
      // Close all the open elements, up the stack
      for (let i = stack.length - 1; i >= pos; i--) {
        // 用于处理类似于
        // <div><h1>Hello</h1>，某些元素没有闭合标签的问题，打印出警告。
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`
          )
        }
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      stack.length = pos
      lastTag = pos && stack[pos - 1].tag
    } else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
