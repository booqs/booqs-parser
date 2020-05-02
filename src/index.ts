import { Booq, BooqMeta } from 'booqs-core';
import { Diagnoser } from './result';
import { openEpub } from './epubFile';
import { processEpub } from './book';
import { getMetadata } from './metadata';

export async function parseEpub({ filePath, diagnoser }: {
    filePath: string,
    diagnoser?: Diagnoser,
}): Promise<Booq | undefined> {
    diagnoser = diagnoser ?? (() => undefined);
    const { value: file, diags: fileDiags } = await openEpub({ filePath });
    fileDiags.forEach(diagnoser);
    if (!file) {
        return undefined;
    }
    const { value: book, diags: bookDiags } = await processEpub(file);
    bookDiags.forEach(diagnoser);
    return book;
}

export type ExtractedMetadata = {
    metadata: BooqMeta,
    cover?: string,
};
export async function extractMetadata({ filePath, extractCover, diagnoser }: {
    filePath: string,
    extractCover?: boolean,
    diagnoser?: Diagnoser,
}): Promise<ExtractedMetadata | undefined> {
    diagnoser = diagnoser ?? (() => undefined);
    const { value: epub, diags: fileDiags } = await openEpub({ filePath });
    fileDiags.forEach(diagnoser);
    if (!epub) {
        return undefined;
    }
    const metadata = await getMetadata(epub);
    if (extractCover) {
        const coverHref = metadata.cover;
        if (typeof coverHref === 'string') {
            const coverBuffer = await epub.imageResolver(coverHref);
            if (!coverBuffer) {
                diagnoser({
                    diag: `couldn't load cover image: ${coverHref}`,
                });
                return { metadata };
            } else {
                const cover = Buffer.from(coverBuffer).toString('base64');
                return { cover, metadata };
            }
        } else {
            return { metadata };
        }
    } else {
        return { metadata };
    }
}
