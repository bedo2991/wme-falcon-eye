import typescript from '@rollup/plugin-typescript';
import strip from '@rollup/plugin-strip';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
    input: 'main.user.ts',
    output: {
        file: '.out/main.user.js',
        format: 'iife'
    },
    plugins: [
        resolve(), // Locate and bundle third-party dependencies (like Turf.js)
        commonjs(), // Convert CommonJS modules to ES modules
        typescript(
            {
                declaration: false
            }
        ),

        ['release', 'build'].includes(process.env.npm_lifecycle_event) ? strip({
            include: ['**/*.ts'],
            debugger: true,
            functions: ['console.debug', 'console.info',
                'console.log'
            ]
        }) : null,
    ]
};