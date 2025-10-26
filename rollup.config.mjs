import typescript from '@rollup/plugin-typescript';
import strip from '@rollup/plugin-strip';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const isProduction = process.env.NODE_ENV === 'production';
const stripConfig = isProduction ? {
    include: '**/*.(ts|js)',
    functions: ['console.debug'],
    debugger: true
} : false;

let plugins = [
    resolve(), // Locate and bundle third-party dependencies (like Turf.js)
    commonjs(), // Convert CommonJS modules to ES modules
    strip(stripConfig), // Remove console.debug calls in production
    terser(),
    typescript(
        {
            declaration: false
        }
    )
];

if (isProduction) {
    console.warn("Building for RELEASE");
    plugins.push(terser());
} else {
    console.log("Building for development");
    // Remove the strip plugin for development to preserve console.debug
    plugins = plugins.filter(plugin => plugin.name !== 'strip');
}

export default {
    input: 'main.user.ts',
    output: {
        file: '.out/main.user.js',
        format: 'iife'
    },
    plugins: plugins
};