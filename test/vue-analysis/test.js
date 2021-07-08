function createCompare(property) {
  return function (obj1, obj2) {
    return obj1[property] > obj2[property]
  }
}

let compare = createCompare('age')
console.log(compare({age: 10}, {age: 20}))
