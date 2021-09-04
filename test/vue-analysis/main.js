// 父组件代码字符串
with(this){
  return _c(
    'div',
    {staticClass:"app_container"},
    [
      _c('h1',[_v("我是APP")]),
      _v(" "),
      _c(
        'hello-world',
        {
          scopedSlots:_u(
            [
              {
                key:"default",
                // slotProps = {
                //   user: {
                //     name: 'tom'
                //   }
                // }
                fn:function(slotProps){
                  return [
                    _c(
                      'h3',
                      [_v(_s(slotProps.user.name))]
                    )
                  ]
                }
              }
            ]
          )
        }
      )
    ],
    1
  )
}


// 子组件代码字符串
with(this){
  return _c(
    'div',
    {staticClass:"hello_world"},
    [
      _c('h2',[_v("我是 HelloWorld 组件")]),
      _v(" "),
      _t("default",null,{"user":user})
    ],
    2
  )
}
