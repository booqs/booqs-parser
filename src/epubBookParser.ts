import {
    BooqNode, Result, Diagnostic, Booq, mapNode,
} from 'booqs-core';
import { xmlStringParser, XmlDocument, xml2string, Xml } from './xmlTree';
import { epubFileParser, EpubSection, EpubFile } from './epubFileParser';

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
        const { value, diags } = parseSection(section, epub);
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

function parseSection(section: EpubSection, file: EpubFile): Result<BooqNode[]> {
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

    const nodes = xmls2nodes(body.children);
    const resolved = nodes.map(
        node => mapNode(node, n => resolveNode(n, section, file)),
    );

    return {
        value: resolved,
    };
}

function resolveNode(node: BooqNode, section: EpubSection, file: EpubFile): BooqNode {
    if (node.attrs && node.attrs.id) {
        return {
            ...node,
            id: `${section.filePath}/${node.attrs.id}`,
        };
    } else {
        return node;
    }
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
