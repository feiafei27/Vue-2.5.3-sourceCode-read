function toArray (list, start) {
  start = start || 0
  let i = list.length - start
  const ret = new Array(i)
  while (i--) {
    ret[i] = list[i + start]
  }
  return ret
}

function add(number1, number2){
  console.log(toArray(arguments, 1))

  return number1 + number2
}

add(1, 10)

