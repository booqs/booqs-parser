import {
    BooqNode, Result, Diagnostic, Booq, flatten,
} from 'booqs-core';
import { xmlStringParser, xml2string } from './xmlTree';
import { epubFileParser, EpubSection, EpubFile } from './epubFileParser';
import { processXmls } from './node';

export async function parseEpub({ filePath }: {
    filePath: string,
}): Promise<Result<Booq>> {
    const { value: epub, ...rest } = await epubFileParser({ filePath });
    if (!epub) {
        return rest;
    }

    const nodes: BooqNode[] = [];
    const diags: Diagnostic[] = [];
    for await (const section of epub.sections()) {
        const result = await parseSection(section, epub);
        if (result.value) {
            nodes.push(...result.value);
        }
        if (result.diags) {
            diags.push(...result.diags);
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
        diags,
    };
}

async function parseSection(section: EpubSection, file: EpubFile): Promise<Result<BooqNode[]>> {
    const { value: body, diags: bodyDiags } = await getBody(section);
    if (!body) {
        return { diags: bodyDiags };
    }

    const results = await processXmls(body.children, {
        filePath: section.filePath,
        imageResolver: file.imageResolver,
    });

    return {
        value: results.map(r => r.value),
        diags: [...bodyDiags ?? [], ...flatten(results.map(r => r.diags ?? []))],
    };
}

async function getBody(section: EpubSection) {
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
            value: undefined,
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
            value: undefined,
            diags: [{
                diag: 'no-body',
                data: { xml: xml2string(html) },
            }],
        };
    }

    return { value: body };
}
