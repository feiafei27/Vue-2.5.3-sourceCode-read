const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const rollup = require('rollup')
const uglify = require('uglify-js')

// 判断 dist 目录是否存在，如果不存在的话，创建 dist 文件夹
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist')
}

// builds 是 rollup 配置对象的数组
let builds = require('./config').getAllBuilds()

// 根据命令行传递的参数，过滤掉不需要打包的版本的配置对象。
// package.json 中一共有三个打包命令：
// （1）"build": "node build/build.js",
// （2）"build:ssr": "npm run build -- web-runtime-cjs,web-server-renderer",
// （3）"build:weex": "npm run build -- weex",
// 不同的命令有不同的打包对象，对于不需要打包的配置对象，过滤掉
if (process.argv[2]) {
  const filters = process.argv[2].split(',')
  builds = builds.filter(b => {
    return filters.some(f => b.output.file.indexOf(f) > -1 || b._name.indexOf(f) > -1)
  })
} else {
  // filter out weex builds by default
  builds = builds.filter(b => {
    return b.output.file.indexOf('weex') === -1
  })
}

// 进行编译操作，传递的参数是 rollup 配置对象的数组
build(builds)

// 对 builds（rollup配置对象数组）进行遍历编译操作
function build (builds) {
  let built = 0
  const total = builds.length
  const next = () => {
    // 针对某一个配置对象，进行编译操作
    buildEntry(builds[built]).then(() => {
      built++
      if (built < total) {
        next()
      }
    }).catch(logError)
  }

  next()
}

// 根据 rollup 配置对象进行编译的方法
function buildEntry (config) {
  const output = config.output
  const { file, banner } = output
  const isProd = /min\.js$/.test(file)
  // 使用 rollup 提供的方法进行编译操作
  return rollup.rollup(config)
    // 编译完成之后，执行 bundle 的 generate 方法，生成目标代码
    // rollup 文章的解释：
    // generate code and a sourcemap
    // const { code, map } = await bundle.generate(outputOptions);
    .then(bundle => bundle.generate(output))
    // 在这里，就能够拿到最终生成的代码了
    .then(({ code }) => {
      // 如果是生成生产环境的代码的话，在这里进行代码的压缩操作
      if (isProd) {
        // 压缩后的代码字符串：minified
        var minified = (banner ? banner + '\n' : '') + uglify.minify(code, {
          output: {
            ascii_only: true
          },
          compress: {
            pure_funcs: ['makeMap']
          }
        }).code
        // 将最终生成的代码写到文件中，并且在控制台打印出日志
        return write(file, minified, true)
      } else {
        // 将最终生成的代码写到文件中，并且在控制台打印出日志
        return write(file, code)
      }
    })
}

// 将最终生成的代码写到文件中，并且在控制台打印出日志
function write (dest, code, zip) {
  return new Promise((resolve, reject) => {
    // 封装一个打印日志的方法
    function report (extra) {
      console.log(blue(path.relative(process.cwd(), dest)) + ' ' + getSize(code) + (extra || ''))
      resolve()
    }

    // 利用 node 中的 writeFile 将生成的代码写到文件系统中
    fs.writeFile(dest, code, err => {
      if (err) return reject(err)
      if (zip) {
        zlib.gzip(code, (err, zipped) => {
          if (err) return reject(err)
          report(' (gzipped: ' + getSize(zipped) + ')')
        })
      } else {
        report()
      }
    })
  })
}

// 辅助方法：计算字符串的大小
function getSize (code) {
  return (code.length / 1024).toFixed(2) + 'kb'
}

function logError (e) {
  console.log(e)
}

function blue (str) {
  return '\x1b[1m\x1b[34m' + str + '\x1b[39m\x1b[22m'
}
