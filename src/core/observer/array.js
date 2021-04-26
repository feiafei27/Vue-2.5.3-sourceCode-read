// 该文件用于重写 Array.prototype 对象中一些能够改变数组内容的函数

import { def } from '../util/index'

// 拿到 Array 的 prototype 原型对象
const arrayProto = Array.prototype
// 利用 Object.create() 创建一个新的对象，并且这个新的对象的原型链(__proto__)指向 arrayProto。
// 这样的话，我们只需要将一些需要改写的方法定义到 arrayMethods 对象中即可。
// 这样的话，我们既可以访问到 arrayMethods 对象中已经改写了的方法，也能访问到 arrayProto 对象中未改写的方法
// ^o^ 完美！
export const arrayMethods = Object.create(arrayProto)

// 能够改变数组内容方法的数组
;[
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]
  // 进行遍历处理
.forEach(function (method) {
  // 缓存原生的相应方法
  const original = arrayProto[method]
  // 定义该 method 对应的自定义方法
  def(arrayMethods, method, function mutator (...args) {
    // 执行原生方法拿到执行结果值，在最后将这个结果值返回
    const result = original.apply(this, args)
    // 这里的 this 是执行当前方法的数组的实例。在 Vue 中，每个数据都会有 __ob__ 属性，这个属性
    // 是 Observer 的实例，该实例有一个 dep 属性（Dep 的实例），该属性能够收集数组的依赖
    const ob = this.__ob__
    // 数组有三种新增数据的方法。分别是：'push','unshift','splice'
    // 这些新增的数据也需要变成响应式的，在这里，使用 inserted 变量记录新增的数据
    let inserted
    switch (method) {
      // 如果当前的方法是 push 或者 unshift 的话，新增的数据就是 args，将 args 设值给 inserted 即可
      case 'push':
      case 'unshift':
        inserted = args
        break
      // 如果当前的方法是 splice 的话，那么插入的数据就是 args.slice(2)
      case 'splice':
        inserted = args.slice(2)
        break
    }
    // 如果的确新增了数据的话，将 inserted 作为参数执行 observer.observeArray() 方法，把新增的每个元素都变成响应式的
    if (inserted) ob.observeArray(inserted)
    // 通知 ob.dep 中的依赖
    ob.dep.notify()
    // 在最后，返回 Array 方法执行的结果
    return result
  })
})
