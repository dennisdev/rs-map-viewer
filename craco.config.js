const { when, whenDev, addBeforeLoader, loaderByName } = require("@craco/craco");

const ThreadsPlugin = require('threads-plugin');

module.exports = {
  webpack: {
    configure: {
      resolve: {
        fallback: {
          fs: false,
        },
      },
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