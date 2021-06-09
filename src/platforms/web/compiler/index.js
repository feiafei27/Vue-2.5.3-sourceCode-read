/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'

// createCompiler 是一个函数，作用是根据 baseOptions，创建生成编译器函数
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
