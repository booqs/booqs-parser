import { Booq } from 'booqs-core';
import { Result, Diagnostic } from './result';
import { openEpub } from './epubFile';
import { processEpub } from './book';
import { getMetadata } from './metadata';

export async function parseEpub(filePath: string): Promise<Result<Booq>> {
    const diags: Diagnostic[] = [];
    const { value: file, diags: fileDiags } = await openEpub({ filePath });
    diags.push(...fileDiags);
    if (!file) {
        return { diags };
    }
    const { value: book, diags: bookDiags } = await processEpub(file);
    diags.push(...bookDiags);
    return {
        value: book,
        diags,
    };
}

export async function parseMetadata(filePath: string) {
    const diags: Diagnostic[] = [];
    const { value: epub, diags: fileDiags } = await openEpub({ filePath });
    diags.push(...fileDiags);
    if (!epub) {
        return { diags };
    }
    const metadata = await getMetadata(epub);
    return {
        value: metadata,
        diags,
    };
}

export async function parseCover(filePath: string) {
    const diags: Diagnostic[] = [];
    const { value: epub, diags: fileDiags } = await openEpub({ filePath });
    diags.push(...fileDiags);
    if (!epub) {
        return { diags };
    }
    const metadata = await getMetadata(epub);
    const coverHref = metadata.cover;
    if (typeof coverHref === 'string') {
        const coverBuffer = await epub.imageResolver(coverHref);
        if (!coverBuffer) {
            diags.push({
                diag: `couldn't load cover image: ${coverHref}`,
            });
            return { value: null, diags };
        } else {
            const base64 = Buffer.from(coverBuffer).toString('base64');
            return {
                value: {
                    cover: base64,
                    meta: metadata,
                },
                diags,
            };
        }
    } else {
        return { value: null, diags };
    }
}