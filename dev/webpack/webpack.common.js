const webpack = require('webpack')
const path = require('path')
const fs = require('fs-extra')

const { VueLoaderPlugin } = require('vue-loader')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const HtmlWebpackPugPlugin = require('html-webpack-pug-plugin')
const VuetifyLoaderPlugin = require('vuetify-loader/lib/plugin')
const WebpackBarPlugin = require('webpackbar')

const babelConfig = fs.readJsonSync(path.join(process.cwd(), '.babelrc'))
const babelDir = path.join(process.cwd(), '.webpack-cache/babel')

const sassLoader = (indentedSyntax) => ({
  loader: 'sass-loader',
  options: {
    implementation: require('sass'),
    sourceMap: false,
    sassOptions: {
      quietDeps: true,
      ...indentedSyntax && { indentedSyntax: true }
    }
  }
})

module.exports = {
  entries: {
    app: './client/index-app.js',
    setup: './client/index-setup.js'
  },
  outputBase: {
    path: path.join(process.cwd(), 'assets'),
    publicPath: '/_assets/',
    globalObject: 'this',
    crossOriginLoading: 'use-credentials'
  },
  cache: (configFile) => ({
    type: 'filesystem',
    cacheDirectory: path.join(process.cwd(), '.webpack-cache/cache'),
    buildDependencies: {
      config: [configFile, path.join(process.cwd(), '.babelrc')]
    }
  }),
  /**
   * Shared module.rules
   *
   * @param {string|object} cssFrontLoader First loader of the .css / .scss chains:
   *   MiniCssExtractPlugin.loader (prod) or 'style-loader' (dev).
   *   The Vuetify .sass chain always uses style-loader (runtime injection).
   */
  rules: (cssFrontLoader) => [
    {
      test: /\.js$/,
      exclude: (modulePath) => {
        return modulePath.includes('node_modules') && !modulePath.includes('vuetify')
      },
      use: [
        {
          loader: 'babel-loader',
          options: {
            ...babelConfig,
            cacheDirectory: babelDir
          }
        }
      ]
    },
    {
      test: /\.css$/,
      use: [
        cssFrontLoader,
        'css-loader',
        'postcss-loader'
      ]
    },
    {
      test: /\.sass$/,
      use: [
        'style-loader',
        'css-loader',
        'postcss-loader',
        sassLoader(true)
      ]
    },
    {
      test: /\.scss$/,
      use: [
        cssFrontLoader,
        'css-loader',
        'postcss-loader',
        sassLoader(false),
        {
          loader: 'sass-resources-loader',
          options: {
            resources: path.join(process.cwd(), '/client/scss/global.scss')
          }
        }
      ]
    },
    {
      test: /\.vue$/,
      loader: 'vue-loader'
    },
    {
      test: /\.pug$/,
      exclude: [
        path.join(process.cwd(), 'dev')
      ],
      loader: 'pug-plain-loader'
    },
    {
      test: /\.(png|jpg|gif)$/,
      type: 'asset',
      parser: {
        dataUrlCondition: {
          maxSize: 8192
        }
      }
    },
    {
      test: /\.svg$/,
      type: 'asset/resource',
      generator: {
        filename: 'svg/[name][ext]'
      }
    },
    {
      test: /\.(graphql|gql)$/,
      exclude: /node_modules/,
      loader: 'graphql-tag/loader'
    },
    {
      test: /\.(woff2|woff|ttf|eot)(\?v=\d+\.\d+\.\d+)?$/,
      type: 'asset/resource',
      generator: {
        filename: 'fonts/[name][ext]'
      }
    }
  ],
  plugins: () => [
    new VueLoaderPlugin(),
    new VuetifyLoaderPlugin(),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser.js'
    }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'client/static' },
        { from: './node_modules/prismjs/components', to: 'js/prism' }
      ]
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/master.pug',
      filename: '../server/views/master.pug',
      hash: false,
      inject: false,
      excludeChunks: ['setup']
    }),
    new HtmlWebpackPlugin({
      template: 'dev/templates/setup.pug',
      filename: '../server/views/setup.pug',
      hash: false,
      inject: false,
      excludeChunks: ['app']
    }),
    new HtmlWebpackPugPlugin(),
    new WebpackBarPlugin({
      name: 'Client Assets'
    })
  ],
  resolve: {
    mainFields: ['browser', 'main', 'module'],
    symlinks: true,
    alias: {
      '@': path.join(process.cwd(), 'client'),
      // -> Runtime-only build: no template compiler in the browser (CSP without 'unsafe-eval')
      vue$: 'vue/dist/vue.runtime.esm.js',
      gql: path.join(process.cwd(), 'client/graph'),
      // -> Lazy-loaded editor translations (a dynamic import cannot go through the package's exports map)
      'ckeditor5-translations': path.join(process.cwd(), 'node_modules/ckeditor5/dist/translations')
    },
    extensions: [
      '.js',
      '.json',
      '.vue'
    ],
    modules: [
      'node_modules'
    ],
    fallback: {
      fs: false,
      crypto: false,
      path: false,
      util: require.resolve('util/'),
      stream: require.resolve('stream-browserify')
    }
  },
  stats: {
    children: false,
    entrypoints: false
  },
  // -> Sass deprecation warnings raised inside Vuetify 2's own stylesheets (not fixable here)
  ignoreWarnings: [
    { module: /node_modules[\\/]vuetify[\\/]/, message: /deprecation/i }
  ]
}
