<template>
  <div id="app">
    <div class="container">
      Hello World
      <span>!!!!</span>
    </div>
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
        this.isShow = !this.isShow
      }
    }
  }
</script>
