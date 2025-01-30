import { spawn } from 'child_process';
import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import postcss from 'rollup-plugin-postcss';
import sveltePreprocess from 'svelte-preprocess';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import copy from 'rollup-plugin-copy';

const production = !process.env.ROLLUP_WATCH;
const repoName = "unsmurf";

function serve() {
    let server;

    function toExit() {
        if (server) server.kill(0);
    }

    return {
        writeBundle() {
            if (server) return;
            server = spawn('npm', ['run', 'start', '--', '--dev'], {
                stdio: ['ignore', 'inherit', 'inherit'],
                shell: true,
            });

            process.on('SIGTERM', toExit);
            process.on('exit', toExit);
        },
    };
}

export default {
    input: 'src/main.js',
    output: {
        sourcemap: true,
        format: 'iife',
        name: 'app',
        file: 'public/build/bundle.js',
        globals: {
            base: production ? `/${repoName}` : ""
        },  
    },
    plugins: [
        svelte({
            preprocess: sveltePreprocess({
                postcss: true,
            }),
            compilerOptions: {
                dev: !production,
                compatibility: {
                    componentApi: 4,
                },
            },
        }),
    
        // Run the development server in dev mode
        !production && serve({
            open: true, // Open browser
            contentBase: ['public', 'static'],
            host: 'localhost',
            port: 8080,
        }),
    
        // Process TailwindCSS and PostCSS plugins
        postcss({
            extract: 'public/build/bundle.css',
            minimize: production,
            plugins: [
                tailwindcss('./tailwind.config.js'),
                autoprefixer(),
            ],
        }),
    
        // Resolve dependencies
        resolve({
            browser: true,
            dedupe: ['svelte'],
            exportConditions: ['svelte'],
        }),
        commonjs(),
    
        copy({
            targets: [
                { src: 'static/*', dest: 'public/static' }, // Copy static files
            ],
        }),
    
        // Watch the `public` directory for changes and reload
        !production && livereload('public'),
    
        // Minify in production with compatibility fixes
        production && terser({
            ecma: 2015,
            compress: {
                drop_console: true,
            },
        }),
    ],
    watch: {
        clearScreen: false,
    },
};