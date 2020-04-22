import { epubFileParser, EpubSection } from './epubFileParser';
import { xmlStringParser, XmlDocument, xml2string, Xml } from './xmlTree';
import { BooqNode, Result, Diagnostic, Booq } from 'booqs-core';

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
        const { value, diags } = parseSection(section);
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

function parseSection(section: EpubSection): Result<BooqNode[]> {
    const { value: document, diags } = xmlStringParser({
        xmlString: section.content,
        removeTrailingWhitespaces: false,
    });
    if (!document) {
        return { diags };
    }

    const nodes = documentParser(document);
    return nodes;
}

function documentParser(document: XmlDocument): Result<BooqNode[]> {
    const html = document.children
        .find(n => n.name === 'html');
    if (html === undefined || html.type !== 'element') {
        return {
            value: [],
            diags: [{
                diag: 'no-html',
                xml: xml2string(document),
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
                xml: xml2string(html),
            }],
        };
    }

    return {
        value: xmls2nodes(body.children),
    };
}

function xmls2nodes(xmls: Xml[]): BooqNode[] {
    return xmls.map(xml2node);
}

function xml2node(xml: Xml): BooqNode {
    switch (xml.type) {
        case 'text':
            return {
                node: 'text',
                content: xml.text,
            };
        case 'element':
            return {
                name: xml.name,
                children: xmls2nodes(xml.children),
                attrs: xml.attributes,
            };
        default:
            return {
                node: 'ignore',
                comment: xml2string(xml),
            };
    }
}
