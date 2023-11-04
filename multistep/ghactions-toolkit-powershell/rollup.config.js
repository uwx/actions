// @ts-check

// import rollup from 'rollup';
// @ts-ignore
import { swc } from 'rollup-plugin-swc3';
import { default as json } from '@rollup/plugin-json';
import { default as commonjs } from '@rollup/plugin-commonjs';
import { default as nodeResolve } from '@rollup/plugin-node-resolve';

/** @type {import('rollup').RollupOptions} */
export default {
    input: 'nodejs-wrapper-source/main.ts',
    output: {
        file: 'hugoalh.GitHubActionsToolkit/nodejs-wrapper/main.js',
        format: 'cjs',
        indent: false,
        freeze: false,
        sourcemap: true,
        sanitizeFileName: false,
        inlineDynamicImports: true
    },
    preserveEntrySignatures: false,
    plugins: [
        json(),
        commonjs(),
        nodeResolve(),
        swc({
            jsc: {
                target: 'es2019',
                minify: {
                    compress: {
                        defaults: true,
                        passes: 10,
                        unsafe: true,
                        toplevel: true,
                        module: true,
                        // unsafe_arrows: true,
                        unsafe_comps: true,
                        unsafe_math: true,
                        unsafe_symbols: true,
                        unsafe_methods: true,
                        unsafe_proto: true,
                        unsafe_regexp: true,
                        unsafe_undefined: true,
                    },
                    ecma: 2019,
                    mangle: true,
                    sourceMap: true,
                    toplevel: true,
                },
            },
            sourceMaps: true
        }),
    ],
}