<template>
  <div id="app">
    <h1 v-if="score >= 80">优秀</h1>
    <h2 v-else-if="score >= 60">及格</h2>
    <h3 v-else>不及格</h3>
  </div>
</template>
<script>
  export default {
    name: 'App',
    data(){
      return {
        score: 60
      }
    },
    methods: {}
  }
</script>
