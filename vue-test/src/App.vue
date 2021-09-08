<template>
  <div id="app">
    <h1 v-if="isShow" id="h1Element">h1 文本</h1>
    <h2 v-if="!isShow" id="h2Element">h2 文本</h2>

    <button @click="changeIsShow">change isShow</button>
  </div>
</template>
<script>
  export default {
    name: 'App',
    data(){
      return {
        isShow: true
      }
    },
    methods: {
      changeIsShow(){
        this.$nextTick(function () {
          let h1Element = document.getElementById("h1Element")
          let h2Element = document.getElementById("h2Element")

          console.log(h1Element)
          console.log(h2Element)
        })

        this.isShow = !this.isShow
      }
    }
  }
</script>
