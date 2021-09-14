/* @flow */

import { toArray } from '../util/index'

export function initUse (Vue: GlobalAPI) {
  Vue.use = function (plugin: Function | Object) {
    // installedPlugins 数组用于保存已经安装了的插件
    const installedPlugins = (this._installedPlugins || (this._installedPlugins = []))
    if (installedPlugins.indexOf(plugin) > -1) {
      // 如果当前注册的插件已经被安装过了的话，则无需重新安装，直接 return 即可
      return this
    }

    // toArray 是一个工具函数，用于将一个类数组对象转换成真正的数组
    // 该函数的第一个参数是待转换的类数组对象
    // 该函数的第二个参数是指从类数组的哪一个元素开始转换，这里从第二个元素开始转换
    //
    // 那么为什么从第二个元素开始转换呢？这是因为当我们使用 Vue.use 的时候，调用情形如下所示
    // Vue.use(MyPlugin, { someOption: true })
    // 可以发现，use 方法的第一个参数是插件（这个插件有可能是对象或者是函数）,第二个参数是配置对象
    // 而 install 方法的参数是 (Vue,配置对象)，所以在这里需要从第二个元素开始转换
    const args = toArray(arguments, 1)
    // 此时 args = [配置对象]，install 方法还需要 Vue 参数，在当前执行环境下，this 就是 Vue
    // 因此，在这里，调用 args.unshift(this) 将 Vue 添加到 args 数组的前面
    // args = [Vue, 配置对象]
    args.unshift(this)
    // 插件有可能是数组或者函数。如果是函数的话，则直接将其当做 install，
    // 如果是对象的话，则这个对象内应该定义 install 方法
    if (typeof plugin.install === 'function') {
      // 这里处理插件是对象的情况，此时执行 plugin.install.apply(plugin, args)
      // 在这里，因为 install 定义在 plugin 中，所以 apply 的第一个参数是 plugin 本身
      // install 函数中的 this 指向 plugin
      // apply 的第二个参数是 args = [Vue, 配置对象]，这会成为 install 方法的参数
      plugin.install.apply(plugin, args)
    } else if (typeof plugin === 'function') {
      // 如果插件是函数的话，则直接将插件当做 install 函数进行调用
      plugin.apply(null, args)
    }
    // 将当前安装的插件保存到 installedPlugins 数组中
    installedPlugins.push(plugin)
    return this
  }
}
