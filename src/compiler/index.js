/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(
  // 基础编译的函数,分为三步：（1）解析器；（2）优化器；（3）代码生成器
  function baseCompile (
    template: string,
    options: CompilerOptions
  ): CompiledResult {
    // 1，解析器
    const ast = parse(template.trim(), options)
    // 2，优化器
    optimize(ast, options)
    // 3，代码生成器
    const code = generate(ast, options)
    return {
      ast,
      render: code.render,
      staticRenderFns: code.staticRenderFns
    }
  }
)
