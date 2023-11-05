// @ts-check

// import rollup from 'rollup';
// @ts-ignore
import { swc } from 'rollup-plugin-swc3';
import { default as json } from '@rollup/plugin-json';
import { default as commonjs } from '@rollup/plugin-commonjs';
import { default as nodeResolve } from '@rollup/plugin-node-resolve';
import { default as nativePlugin } from 'rollup-plugin-natives';
import path from 'path';
import fs from 'fs/promises';

/** @type {import('rollup').RollupOptions} */
export default {
    input: 'entrypoint.ts',
    output: {
        file: 'dist/index.js',
        format: 'cjs',
        indent: false,
        freeze: false,
        sourcemap: true,
        sanitizeFileName: false,
        // inlineDynamicImports: true
    },
    preserveEntrySignatures: false,
    plugins: [
        /** @type {import('rollup').Plugin} */ (nativePlugin({
            // Where we want to physically put the extracted .node files
            copyTo: 'dist/libs',

            // Path to the same folder, relative to the output bundle js
            destDir: './libs',

            // Use `dlopen` instead of `require`/`import`.
            // This must be set to true if using a different file extension that '.node'
            dlopen: false,

            // Modify the final filename for specific modules
            // A function that receives a full path to the original file, and returns a desired filename
            // map: (modulePath) => 'filename.node',

            // OR you can have a function that returns a desired file name and a specific destination to copy to.
            // map: (modulePath) => { name: 'filename.node', copyTo: 'C:\\Dist\\libs\\filename.node' },

            // A transformer function that allows replacing a given node module path with another.
            // This is good for either handling missing files, or dynamically resolving desired architectures etc.
            // originTransform: (path: string, exists: boolean) => (path: string | undefined),

            // Generate sourcemap
            sourcemap: true,

            // If the target is ESM, so we can't use `require` (and .node is not supported in `import` anyway), we will need to use `createRequire` instead.
            targetEsm: false,
        })),
        /** @satisfies {import('rollup').Plugin} */ ({
            name: '.node loader',
            async load(id) {
                if (id.endsWith('.node') || id.endsWith('.dll') || id.endsWith('.dylib') || id.endsWith('.so')) {
                    const moduleName = path.basename(id);
                    if (!this.cache.get(moduleName)) {
                        this.cache.set(moduleName, true);
                        await fs.copyFile(id, path.resolve('dist/libs', moduleName));
                    }

                    return `export const __require = require(${JSON.stringify('./libs/' + moduleName)})`;
                }
            }
        }),
        json(),
        commonjs({
            dynamicRequireTargets: [
                'node_modules/sharp/build/Release/sharp-*.node',
                'node_modules/sharp/build/Release/*.dll',
                'node_modules/sharp/build/Release/*.dylib',
                'node_modules/sharp/build/Release/*.so',
                'node_modules/sharp/build/Release/*/sharp-*.node',
                'node_modules/sharp/vendor/**/versions.json',
            ]
        }),
        nodeResolve(),
        swc({
            jsc: {
                target: 'es2020',
                minify: {
                    compress: false,
                    ecma: 2020,
                    mangle: false,
                    sourceMap: true,
                    toplevel: true,
                }
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