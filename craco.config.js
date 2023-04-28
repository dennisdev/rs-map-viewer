const { when, whenDev, addBeforeLoader, loaderByName } = require("@craco/craco");

const ThreadsPlugin = require('threads-plugin');

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      const glslLoader = {
        test: /\.(glsl|vs|fs)$/,
        loader: 'ts-shader-loader'
      };

      // Kind of a hack to get the glsl loader to work
      // https://github.com/dilanx/craco/issues/486
      for (const rule of webpackConfig.module.rules) {
        if (rule.oneOf) {
          rule.oneOf.unshift(glslLoader);
          break;
        }
      }

      // addBeforeLoader(webpackConfig, loaderByName('file-loader'), glslLoader);

      webpackConfig.resolve.fallback = {
        fs: false
      };

      return webpackConfig;
    },
    plugins: [
      new ThreadsPlugin()
    ]
  },
  devServer: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp"
    }
  }
};

// module.exports = {
//   webpack: {
//     configure: (webpackConfig) => {
//       webpackConfig.resolve.fallback = {
//         fs: false
//       };

//       const wasmExtensionRegExp = /\.wasm$/;
//       webpackConfig.resolve.extensions.push('.wasm');

//       webpackConfig.module.rules.forEach((rule) => {
//         (rule.oneOf || []).forEach((oneOf) => {
//           if (oneOf.loader && oneOf.loader.indexOf('file-loader') >= 0) {
//             oneOf.exclude.push(wasmExtensionRegExp);
//           }
//         });
//       });

//       const wasmLoader = {
//         test: /\.wasm$/,
//         exclude: /node_modules/,
//         loaders: ['wasm-loader'],
//       };

//       addBeforeLoader(webpackConfig, loaderByName('file-loader'), wasmLoader);

//       return webpackConfig;
//     },
//   },
// };

// module.exports = {
//     webpack: {
//         // configure: {
//         //     resolve: {
//         //         fallback: {
//         //             fs: false,
//         //         },
//         //     },
//         // },
//         configure: (webpackConfig) => {
//             const wasmExtensionRegExp = /\.wasm$/;
//             webpackConfig.resolve.extensions.push('.wasm');
      
//             webpackConfig.module.rules.forEach((rule) => {
//               (rule.oneOf || []).forEach((oneOf) => {
//                 if (oneOf.loader && oneOf.loader.indexOf('file-loader') >= 0) {
//                   oneOf.exclude.push(wasmExtensionRegExp);
//                 }
//               });
//             });
      
//             const wasmLoader = {
//               test: /\.wasm$/,
//               exclude: /node_modules/,
//               loaders: ['wasm-loader'],
//             };
      
//             addBeforeLoader(webpackConfig, loaderByName('file-loader'), wasmLoader);
      
//             return webpackConfig;
//           },
//     }
// };