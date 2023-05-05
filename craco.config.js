const {
    when,
    whenDev,
    addBeforeLoader,
    loaderByName,
} = require("@craco/craco");

const ThreadsPlugin = require("threads-plugin");

const express = require("express");

module.exports = {
    webpack: {
        configure: (webpackConfig) => {
            const glslLoader = {
                test: /\.(glsl|vs|fs)$/,
                loader: "ts-shader-loader",
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
                fs: false,
            };

            return webpackConfig;
        },
        plugins: [new ThreadsPlugin()],
    },
    devServer: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
        setupMiddlewares: (middlewares, devServer) => {
            if (!devServer) {
                throw new Error("webpack-dev-server is not defined");
            }

            devServer.app.use("/caches", express.static("caches"));

            return middlewares;
        },
    },
};
