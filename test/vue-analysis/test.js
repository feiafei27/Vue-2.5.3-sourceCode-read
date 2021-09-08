// 以下代码会得到什么样的输出结果？
console.log('1');

setTimeout(function() {
  console.log('2');
  Promise.resolve().then(function() {
    console.log('3');
  });
}, 0);
setTimeout(function() {
  console.log('7');
  Promise.resolve().then(function() {
    console.log('8');
  });
}, 0);

Promise.resolve().then(function() {
  console.log('4');
}).then(function() {
  console.log('5');
});
console.log('6');
