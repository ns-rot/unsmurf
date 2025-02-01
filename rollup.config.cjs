const { spawn } = require('child_process');
const svelte = require('rollup-plugin-svelte');
const commonjs = require('@rollup/plugin-commonjs');
const terser = require('@rollup/plugin-terser');
const resolve = require('@rollup/plugin-node-resolve');
const livereload = require('rollup-plugin-livereload');
const postcss = require('rollup-plugin-postcss');
const sveltePreprocess = require('svelte-preprocess');
const autoprefixer = require('autoprefixer');
const tailwindcss = require('tailwindcss');
const copy = require('rollup-plugin-copy');

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

module.exports = {
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

        // PostCSS with TailwindCSS
        postcss({
            extract: 'public/build/bundle.css',
            minimize: production,
            plugins: [
                tailwindcss('./tailwind.config.js'), // Ensure Tailwind is loaded properly
                autoprefixer(),
            ],
        }),

        // Copy static assets
        copy({
            targets: [
                { src: 'static/*', dest: 'public/static' }, // Copy all files from static/ to public/static
            ],
        }),

        resolve({
            browser: true,
            dedupe: ['svelte'],
            exportConditions: ['svelte'],
        }),
        commonjs(),

        // Start development server
        !production && serve(),

        // Watch and reload in dev mode
        !production && livereload('public'),

        // Minify for production
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