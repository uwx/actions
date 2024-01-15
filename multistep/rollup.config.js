// @ts-check

// import rollup from 'rollup';
import { default as json } from '@rollup/plugin-json';
import { default as commonjs } from '@rollup/plugin-commonjs';
import { default as nodeResolve } from '@rollup/plugin-node-resolve';
import swc from 'unplugin-swc';

// @ts-ignore
const swc1 = /** @type {typeof swc} */ (swc.default);

/** @type {import('rollup').RollupOptions} */
export default {
    input: './index.ts',
    output: {
        file: 'dist/index.js',
        format: 'commonjs',
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
        swc1.rollup({
            include: /\.m?[jt]sx?$/, // default
            exclude: /** @type {any} */ (/node_modules/),
            jsc: {
                parser: {
                    syntax: 'typescript'
                },
                target: 'es2020',
                //transform: {
                //    optimizer: {
                //        jsonify: {
                //            minCost: 15
                //        },
                //        simplify: true
                //    }
                //},
                minify: undefined,
                //minify: {
                //    compress: true,
                //    ecma: 2020,
                //    mangle: true,
                //    sourceMap: true,
                //    toplevel: true,
                //}
            },
            sourceMaps: true
        }),
        //minify({
        //    compress: {
        //        defaults: true,
        //        passes: 10,
        //        unsafe: true,
        //        toplevel: true,
        //        module: true,
        //        // unsafe_arrows: true,
        //        unsafe_comps: true,
        //        unsafe_math: true,
        //        unsafe_symbols: true,
        //        unsafe_methods: true,
        //        unsafe_proto: true,
        //        unsafe_regexp: true,
        //        unsafe_undefined: true,
        //    },
        //    ecma: 2019,
        //    mangle: true,
        //    sourceMap: true,
        //    toplevel: true,
        //})
    ],
}