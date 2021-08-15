<template>
  <div id="app">
    <div class="container">
      <h1 v-if="isShow">h1 isShow: true</h1>
      <h2 v-if="!isShow">h2 isShow: false</h2>
    </div>
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
        this.isShow = !this.isShow
      }
    }
  }
</script>
