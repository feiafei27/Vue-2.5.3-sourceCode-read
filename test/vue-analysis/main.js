let target = {
  name: 'jack',
  age: 20
}

let vm = {
  name: 'tom',
  age: '10',
  render(){
    with(this){
      console.log(name, age)
    }
  }
}


vm.render()
