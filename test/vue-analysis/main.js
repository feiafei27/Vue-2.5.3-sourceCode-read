const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)

export function parseHTML (html, options) {
  // 栈数据结构对于模板的解析很重要，用于维护父子关系
  const stack = []
  let index = 0
  // last 变量用于记录 html 字符串上一次解析之前的状态
  let last, lastTag

  // 解析 html 的过程，就是不断的截取和解析的过程，直至 html 字符串被解析完
  // 所以在这里，使用 while (html) 不断的遍历 html 字符串
  while (html) {
    // 获取当前的 html 中首个 '<' 的下标位置
    let textEnd = html.indexOf('<')
    // 如果 < 的下标是 0 的话，说明当前 html 字符串的开头是一个标签
    if (textEnd === 0) {
      //// 接下来判断这个开头的标签是什么类型的标签

      // 使用 comment 正则表达式判断是不是注释标签
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
        // 如果当前 html 的开头的确是开始标签的话，则调用 handleStartTag 进行处理，其内部会调用 options 中的回调函数
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
  }

  //// 用于HTML解析的辅助函数

  // 作用：截取 html 字符串，截取掉前 n 位
  function advance (n) {}

  // 用于解析开始标签
  function parseStartTag () {}

  // 进一步解析 parseStartTag 返回的对象，并且调用 options.start 回调函数
  function handleStartTag (match) {}

  // 处理结束标签，并会调用回调函数
  function parseEndTag (tagName, start, end) {}
}
