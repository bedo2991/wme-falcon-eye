import typescript from '@rollup/plugin-typescript';
import strip from '@rollup/plugin-strip';

export default {
    input: 'main.user.ts',
    output: {
        file: '.out/main.user.js',
        format: 'iife'
    },
    plugins: [
        typescript(),
        strip({
            include: ['**/*.ts'],
            debugger: true,
            functions: ['console.debug', 'console.info',
                'console.log'
            ]
        }),
    ]
};