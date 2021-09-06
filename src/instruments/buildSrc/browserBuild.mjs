import fs from 'fs';
import { join } from 'path';
import { baseCompile } from './plugins.mjs';
import { Directories } from './directories.mjs';
import { getInputs } from './igniter/tasks.mjs';

process.chdir(Directories.src);

if (!fs.existsSync(join(Directories.instruments, 'devServer/bundles'))) {
    fs.mkdirSync(join(Directories.instruments, 'devServer/bundles'), {recursive: true});
}

const builds = getInputs()
    .map(({ path, name }) => {
        const config = JSON.parse(fs.readFileSync(join(Directories.instruments, 'src', path, 'config.json')));

        return {
            watch: true,
            name,
            input: join(Directories.instruments, 'src', path, config.index),
            output: {
                file: join(Directories.instruments, 'devServer/bundles', path, 'bundle.js'),
                format: 'iife',
            },
            plugins: [
                ...baseCompile(name, path),
            ],
        };
    });

const instruments = getInputs().map(({ path }) => path);

fs.writeFileSync(join(Directories.instruments, 'devServer/instruments.json'), JSON.stringify(instruments));

export default builds;
