/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'

// 返回一个函数，函数的作用是：创建编译器函数
export function createCompilerCreator (baseCompile: Function): Function {
  return function createCompiler (baseOptions: CompilerOptions) {
    // 具体的编译过程在 baseCompile 函数中：const compiled = baseCompile(template, finalOptions)
    // compile 函数主要是进行了编译配置对象(baseOptions、options)的处理
    function compile (
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      ////////////////// 对 baseOptions 和 options 进行一些处理 //////////////////
      // 最终 baseCompile 函数使用的配置对象，借助 Object.create() 函数创建一个空对象，该对象的原型链指向 baseOptions
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []
      finalOptions.warn = (msg, tip) => {
        (tip ? tips : errors).push(msg)
      }

      // 如果传了 options 的话，再进行合并处理
      if (options) {
        // 配置对象中的 modules 和 directives 属性，进行合并处理
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives),
            options.directives
          )
        }
        // 除 modules 和 directives 以外的其他属性直接赋值到 finalOptions 中，不用考虑 baseOptions 中相同 key 的配置
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }
      ////////////////// 对 baseOptions 和 options 进行一些处理 //////////////////

      const compiled = baseCompile(template, finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        errors.push.apply(errors, detectErrors(compiled.ast))
      }
      compiled.errors = errors
      compiled.tips = tips
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
