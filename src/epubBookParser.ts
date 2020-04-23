import {
    BooqNode, Result, Diagnostic, Booq, flatten,
} from 'booqs-core';
import { xmlStringParser, xml2string } from './xmlTree';
import { epubFileParser, EpubSection, EpubFile } from './epubFileParser';
import { processXmls } from './node';

export async function parseEpub({ filePath }: {
    filePath: string,
}): Promise<Result<Booq>> {
    const { value: epub, diags } = await epubFileParser({ filePath });
    if (!epub) {
        return { diags };
    }

    const nodes: BooqNode[] = [];
    const allDiags: Diagnostic[] = [];
    for await (const section of epub.sections()) {
        const { value, diags } = await parseSection(section, epub);
        if (value) {
            nodes.push(...value);
        }
        if (diags) {
            allDiags.push(...diags);
        }
    }

    return {
        value: {
            nodes,
            meta: {},
            toc: {
                title: undefined,
                items: [],
                length: 0,
            },
        },
        diags: allDiags,
    };
}

async function parseSection(section: EpubSection, file: EpubFile): Promise<Result<BooqNode[]>> {
    const { value: document, diags } = xmlStringParser({
        xmlString: section.content,
        removeTrailingWhitespaces: false,
    });
    if (!document) {
        return { diags };
    }
    const html = document.children
        .find(n => n.name === 'html');
    if (html === undefined || html.type !== 'element') {
        return {
            value: [],
            diags: [{
                diag: 'no-html',
                data: { xml: xml2string(document) },
            }],
        };
    }
    const body = html.children
        .find(n => n.name === 'body');
    if (body === undefined || body.type !== 'element') {
        return {
            value: [],
            diags: [{
                diag: 'no-body',
                data: { xml: xml2string(html) },
            }],
        };
    }

    const results = await processXmls(body.children, {
        filePath: section.filePath,
        imageResolver: file.imageResolver,
    });

    return {
        value: results.map(r => r.value),
        diags: flatten(results.map(r => r.diags ?? [])),
    };
}
