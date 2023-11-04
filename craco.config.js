const { when, whenDev, addBeforeLoader, loaderByName } = require("@craco/craco");

const ThreadsPlugin = require("threads-plugin");
const JsonMinimizerPlugin = require("json-minimizer-webpack-plugin");

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

            webpackConfig.module.rules.push({
                resourceQuery: /url/,
                type: "asset/resource",
            });

            // addBeforeLoader(webpackConfig, loaderByName('file-loader'), glslLoader);

            webpackConfig.resolve.fallback = {
                fs: false,
            };

            webpackConfig.resolve.extensions = [".web.js", ...webpackConfig.resolve.extensions];

            webpackConfig.optimization.minimizer.push(new JsonMinimizerPlugin());

            return webpackConfig;
        },
        plugins: [new ThreadsPlugin()],
    },
    devServer: {
        headers: {
            "Cross-Origin-Opener-Policy": "same-origin",
            "Cross-Origin-Embedder-Policy": "require-corp",
        },
        client: {
            overlay: {
                errors: true,
                warnings: false,
                runtimeErrors: (error) => {
                    if (error instanceof DOMException && error.name === "AbortError") {
                        return false;
                    }
                    return true;
                },
            },
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
