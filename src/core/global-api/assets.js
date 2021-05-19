/* @flow */

import config from '../config'
import { ASSET_TYPES } from 'shared/constants'
import { warn, isPlainObject } from '../util/index'

export function initAssetRegisters (Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  // ASSET_TYPES = [
  //   'component',
  //   'directive',
  //   'filter'
  // ]
  // 有三种资产：组件、指令、过滤器
  ASSET_TYPES.forEach(type => {
    // 该函数有两个作用：(1) 传递 definition 的时候，会进行资产的注册，最后会返回 definition
    //                 (2) 没有传递 definition 的时候，会直接返回指定 id 的 definition
    Vue[type] = function (
      id: string,
      definition: Function | Object
    ): Function | Object | void {
      if (!definition) {
        // 如果没有传递 definition 的话，直接返回 id 对应的 definition
        return this.options[type + 's'][id]
      } else {
        // 下面进行资产的注册操作，其实所谓的注册操作：只是将要注册的东西找个地方存放起来而已，很简单。
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production') {
          if (type === 'component' && config.isReservedTag(id)) {
            // 判断注册组件的 tag 是不是 Vue 内置的组件，或者是 HTML 的保留标签
            warn(
              'Do not use built-in or reserved HTML elements as component ' +
              'id: ' + id
            )
          }
        }
        if (type === 'component' && isPlainObject(definition)) {
          // 进行组件 name 的处理，如果 definition 中没有 name 的话，则使用 id 作为组件的 name
          definition.name = definition.name || id
          // _base 属性其实就是 Vue 构造函数
          // 使用 Vue.extend 方法可以创建出 Vue 构造函数的子级构造函数
          // 该子级构造函数的 options 属性是包含 definition 的
          /////////// 组件的本质就是 Vue 构造函数的子级构造函数 ///////////
          definition = this.options._base.extend(definition)
        }
        // 指令必须是对象的形式，如果在这里提供的是函数类型的话，则包装成对象的形式
        if (type === 'directive' && typeof definition === 'function') {
          definition = { bind: definition, update: definition }
        }
        // 将处理好的资产保存到 options 对象中
        // options: {
        //   components:{
        //     id1: definition1,
        //     id2: definition2,
        //   },
        //   directives:{
        //     id3: definition3,
        //     id4: definition4,
        //   },
        //   filters:{
        //     id5: definition5,
        //     id6: definition6,
        //   }
        // }

        // 如果组件的 definition 是函数类型的话，不用做特殊的处理，直接保存到 options.components 中即可
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
