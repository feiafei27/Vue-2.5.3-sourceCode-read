/* @flow */

import { noop, extend } from 'shared/util'
import { warn as baseWarn, tip } from 'core/util/debug'

type CompiledFunctionResult = {
  render: Function;
  staticRenderFns: Array<Function>;
};

// 借助 new Function(xxx) 将代码字符串转换成真正的函数
function createFunction (code, errors) {
  try {
    return new Function(code)
  } catch (err) {
    errors.push({ err, code })
    return noop
  }
}

// 返回值是一个函数。
export function createCompileToFunctionFn (compile: Function): Function {
  const cache: {
    [key: string]: CompiledFunctionResult;
  } = Object.create(null)

  // 该函数的作用是：将 template 模板字符串编译成 render 函数，也就是编译的入口
  // 该函数的核心是：const compiled = compile(template, options)，
  // 编译的具体过程并不在 compileToFunctions 函数中，而是在 compile 函数中。
  // compileToFunctions 函数主要进行了一些缓存和错误消息打印的功能
  return function compileToFunctions (
    template: string,
    options?: CompilerOptions,
    vm?: Component
  ): CompiledFunctionResult {
    // 借助 extend 拷贝一份 options
    options = extend({}, options)
    const warn = options.warn || baseWarn
    delete options.warn

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      // detect possible CSP restriction
      // 编译的最后需要借助 new Function('xxx') 将代码字符串转换成 render 函数。
      // 所以在这里测试一下，当前的环境支不支持 new Function('xxx')，如果不支持的话，打印出警告
      try {
        new Function('return 1')
      } catch (e) {
        if (e.toString().match(/unsafe-eval|CSP/)) {
          warn(
            'It seems you are using the standalone build of Vue.js in an ' +
            'environment with Content Security Policy that prohibits unsafe-eval. ' +
            'The template compiler cannot work in this environment. Consider ' +
            'relaxing the policy to allow unsafe-eval or pre-compiling your ' +
            'templates into render functions.'
          )
        }
      }
    }

    // check cache
    // 进行缓存的处理，因为模板编译的过程比较耗时，同一个模板没有必要编译两遍
    // 缓存的 key。如果定义了 options.delimiters 的话，key 就使用 String(options.delimiters) + template；
    //            否则的话，就使用 template
    const key = options.delimiters
      ? String(options.delimiters) + template
      : template
    if (cache[key]) {
      return cache[key]
    }

    // compile
    // 执行编译，返回值是一个包含下面值的对象
    // declare type CompiledResult = {
    //   ast: ?ASTElement;
    //   render: string;
    //   staticRenderFns: Array<string>;
    //   stringRenderFns?: Array<string>;
    //   errors?: Array<string>;
    //   tips?: Array<string>;
    // };
    const compiled = compile(template, options)

    // check compilation errors/tips
    if (process.env.NODE_ENV !== 'production') {
      if (compiled.errors && compiled.errors.length) {
        // 如果编译出错的话，打印出警告
        warn(
          `Error compiling template:\n\n${template}\n\n` +
          compiled.errors.map(e => `- ${e}`).join('\n') + '\n',
          vm
        )
      }
      if (compiled.tips && compiled.tips.length) {
        compiled.tips.forEach(msg => tip(msg, vm))
      }
    }

    // turn code into functions
    // 当前模板字符串的编译结果对象
    const res = {}
    // fnGenErrors 数组用于保存 createFunction 函数执行过程中抛出的错误信息，用于下面的错误消息打印
    const fnGenErrors = []
    // 将 render 代码字符串转换成函数，并保存到 res 对象中
    res.render = createFunction(compiled.render, fnGenErrors)
    res.staticRenderFns = compiled.staticRenderFns.map(code => {
      return createFunction(code, fnGenErrors)
    })

    // check function generation errors.
    // this should only happen if there is a bug in the compiler itself.
    // mostly for codegen development use
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production') {
      if ((!compiled.errors || !compiled.errors.length) && fnGenErrors.length) {
        // 生成 render 函数失败的错误消息打印
        warn(
          `Failed to generate render function:\n\n` +
          fnGenErrors.map(({ err, code }) => `${err.toString()} in\n\n${code}\n`).join('\n'),
          vm
        )
      }
    }

    // 保存到缓存中，并返回这个 res 对象
    return (cache[key] = res)
  }
}
