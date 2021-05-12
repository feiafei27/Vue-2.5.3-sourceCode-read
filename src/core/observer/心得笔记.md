### 对象，Dep实例，Observer实例之间的关系
假设有如下的数据：
```javascript
let data = {
  person: {
    name: 'tom',
    age: 20
  }
}
```
对象（或者可以说是值，例如 person key 所对应的对象）对应着 Observer 实例；  
对象的 key 对应着一个个 Dep 实例，Dep 实例保存着对象中这个 key 的依赖；  
