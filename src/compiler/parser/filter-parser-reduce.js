function parseFilters(exp) {
  // 以 exp == "message | suffix('!')" 为例进行分析
  // 以 '|' 为基准切分 exp 字符串
  // filters == ["message ", " suffix('!')"]
  let filters = exp.split('|')
  // 弹出 filters 字符串数组的第一个元素赋值给 expression 变量，并且删除前后的空格
  // 这弹出的第一个元素就是过滤器想要处理的数据，数组中剩下的元素都是过滤器字符串和参数
  let expression = filters.shift().trim()
  // 第一个元素弹出后，filters == [" suffix('!')"]
  let i
  // 接下来进行过滤器代码字符串的拼接，调用 wrapFilter 实现功能
  if (filters) {
    // 遍历 filters 数组
    for (i = 0; i < filters.length; i++) {
      // 调用 wrapFilter 方法进行代码字符串的拼接
      // 第一个参数是当前处理过滤器的参数
      // 第二个参数是当前处理过滤器的函数名称
      //
      // wrapFilter 方法的返回值直接赋值给 expression 变量，此时的
      // expression 字符串变成了下一轮过滤器的参数
      expression = wrapFilter(expression, filters[i].trim())
    }
  }
  // 返回最终拼接好的代码字符串
  return expression
}

function wrapFilter(exp, filter) {
  // 判断当前处理的过滤器字符串有没有 '(' 字符
  // 如果有的话，说明当前的过滤器有参数，例如："suffix('!')"
  // 如果没有的话，则当前的过滤器没有参数
  const i = filter.indexOf('(')
  if (i < 0) {
    // 如果 i < 0 的话，说明过滤器字符串中没有 '(' 字符，
    // 也就是说当前的过滤器没有使用参数
    // 此时直接 return `_f("${filter}")(${exp})`
    return `_f("${filter}")(${exp})`
  } else {
    // 如果 i 不是小于 0，则说明当前的过滤器使用了参数，此时就需要对参数进行处理。
    // 原因是因为在过滤器函数的调用中，过滤器函数要处理的目标数据（例如：message）需要作为第一个参数。
    //
    // 以 i 下标为分割点，分割 filter 字符串，例如：filter == "suffix('!')"，则
    // name == "suffix"，args == "'!')"
    const name = filter.slice(0, i) // 过滤器函数名称
    const args = filter.slice(i + 1) // 使用过滤器时，传入的参数
    // 接下来进行代码字符串的拼接。注意，这里 exp 作为过滤器函数调用的第一个参数
    return `_f("${name}")(${exp},${args}`
  }
}

// 测试
let filterRender1 = parseFilters(`message | suffix('!')`)
let filterRender2 = parseFilters(`message | capitalize | suffix('!')`)

console.log(filterRender1) // _f("suffix")(message,'!')
console.log(filterRender2) // _f("suffix")(_f("capitalize")(message),'!')
