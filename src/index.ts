import { Booq, BooqMeta } from 'booqs-core';
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

export type ExtractedMetadata = {
    metadata: BooqMeta,
    cover?: string,
};
export async function extractMetadata(filePath: string, options?: {
    extractCover?: boolean,
}): Promise<Result<ExtractedMetadata>> {
    const diags: Diagnostic[] = [];
    const { value: epub, diags: fileDiags } = await openEpub({ filePath });
    diags.push(...fileDiags);
    if (!epub) {
        return { diags };
    }
    const metadata = await getMetadata(epub);
    if (options?.extractCover) {
        const coverHref = metadata.cover;
        if (typeof coverHref === 'string') {
            const coverBuffer = await epub.imageResolver(coverHref);
            if (!coverBuffer) {
                diags.push({
                    diag: `couldn't load cover image: ${coverHref}`,
                });
                return { value: { metadata }, diags };
            } else {
                const cover = Buffer.from(coverBuffer).toString('base64');
                return {
                    value: { cover, metadata },
                    diags,
                };
            }
        } else {
            return {
                value: { metadata },
                diags,
            };
        }
    } else {
        return {
            value: { metadata },
            diags,
        };
    }
}
