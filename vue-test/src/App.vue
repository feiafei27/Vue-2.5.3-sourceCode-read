<template>
  <div id="app">
    <h1>我是 app</h1>
    <hello-world>
      <h3>我是插槽</h3>
    </hello-world>
  </div>
</template>
<script>
  import HelloWorld from './components/HelloWorld'

  export default {
    name: 'App',
    components: {HelloWorld},
    data(){
      return {
        score: 60
      }
    },
    methods: {}
  }
</script>
