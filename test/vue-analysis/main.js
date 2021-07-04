function a(){
  var age=21;
  var height=178;
  var weight=70;
  function b(){
    console.log(age);//undefined
    console.log(height);//178
    var age=25;
    height=180;   //相当于是在全局作用域里声明了height变量。
    console.log(age);//25
    console.log(height); //180
  }

  b();
}

a(); //备注：如果在函数作用域内声明变量不加var，相当于是在全局作用域里声明了这个变量。
