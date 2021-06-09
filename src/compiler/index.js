/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
export const createCompiler = createCompilerCreator(
  // 真正执行编译功能的函数,分为三步走：（1）解析器 ==>（2）优化器 ==>（3）代码生成器
  function baseCompile (
    template: string,
    options: CompilerOptions
  ): CompiledResult {
    // 1，解析器。将模板字符串转换成抽象语法树
    const ast = parse(template.trim(), options)
    // 2，优化器。遍历抽象语法树，标记静态节点，
    // 因为静态节点是不会变化的，所以重新渲染视图的时候，能够直接跳过静态节点，提升效率。
    optimize(ast, options)
    // 3，代码生成器。使用抽象语法树生成渲染函数字符串
    const code = generate(ast, options)
    return {
      ast,
      render: code.render,
      staticRenderFns: code.staticRenderFns
    }
  }
)
