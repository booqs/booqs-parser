import { Booq } from 'booqs-core';
import { Result, Diagnostic } from './result';
import { openEpub } from './epubFile';
import { processEpub } from './book';

export async function parseEpub({ filePath }: {
    filePath: string,
}): Promise<Result<Booq>> {
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