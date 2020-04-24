#! /usr/bin/env node
// tslint:disable: no-console
import { existsSync, lstat, readdir, writeFile } from 'fs';
import { extname, join, dirname, basename } from 'path';
import { promisify, inspect } from 'util';
import { Booq } from 'booqs-core';
import { parseEpub } from './index';

exec();

async function exec() {
    const args = process.argv;
    const path = args[2];
    const reportMeta = args[3] ? true : false;
    if (!path) {
        console.log('You need to pass epub path as an arg');
        return;
    }
    if (!existsSync(path)) {
        console.log(`Couldn't find file or directory: ${path}`);
        return;
    }

    const files = await listFiles(path);
    const epubs = files.filter(isEpub);
    console.log(epubs);
    logTimeAsync('parsing', async () => {
        for (const epubPath of epubs) {
            await processEpubFile(epubPath, reportMeta ? 2 : 1);
        }
    });
}

async function processEpubFile(filePath: string, verbosity: number = 0) {
    const { value: booq, diags } = await parseEpub({ filePath });
    if (!booq) {
        if (verbosity > -1) {
            logRed(`Couldn't parse epub: '${filePath}'`);
            console.log(diags);
        }
        return;
    }
    if (verbosity > -1) {
        console.log(`---- ${filePath}:`);
    }
    const pathToSave = join(dirname(filePath), `${basename(filePath, '.epub')}.booq`);
    await saveBook(pathToSave, booq);
    if (verbosity > 1) {
        console.log('Metadata:');
        console.log(booq.meta);
    }
    if (diags.length) {
        if (verbosity > -1) {
            logRed('Diagnostics:');
            console.log(inspect(diags, false, 8, true));
        } else if (verbosity > -2) {
            console.log(filePath);
        }

    }

    return diags;
}

async function listFiles(path: string) {
    const isDirectory = (await promisify(lstat)(path)).isDirectory();
    if (isDirectory) {
        const files = await promisify(readdir)(path);
        return files.map(f => join(path, f));
    } else {
        return [path];
    }
}

function isEpub(path: string): boolean {
    return extname(path) === '.epub';
}

function logRed(message: string) {
    console.log(`\x1b[31m${message}\x1b[0m`);
}

async function logTimeAsync(marker: string, f: () => Promise<void>) {
    console.log(`Start: ${marker}`);
    const start = new Date();
    await f();
    const finish = new Date();
    console.log(`Finish: ${marker}, ${finish.valueOf() - start.valueOf()}ms`);
}

async function saveString(path: string, content: string) {
    return promisify(writeFile)(path, content);
}

async function saveBook(path: string, book: Booq) {
    const str = JSON.stringify({ book }, null, undefined);
    return saveString(path, str);
}

export async function wait(n: number) {
    return new Promise(res => setTimeout(() => res(), n));
}
