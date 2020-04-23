import { Success, BooqNode, BooqElementNode, Diagnostic } from 'booqs-core';
import { Xml, XmlElement, xml2string } from './xmlTree';

type Env = {
    filePath: string,
    imageResolver: (src: string) => Promise<Buffer | undefined>,
};
export async function processXmls(xmls: Xml[], env: Env) {
    return Promise.all(
        xmls.map(n => processXml(n, env)),
    );
}

async function processXml(xml: Xml, env: Env): Promise<Success<BooqNode>> {
    switch (xml.type) {
        case 'text':
            return {
                value: {
                    node: 'text',
                    content: xml.text,
                },
            };
        case 'element':
            return processXmlElement(xml, env);
        default:
            return {
                value: {
                    node: 'ignore',
                },
                diags: [{
                    diag: 'unexpected node',
                    data: { xml: xml2string(xml) },
                }],
            };
    }
}

async function processXmlElement(element: XmlElement, env: Env): Promise<Success<BooqNode>> {
    switch (element.name) {
        case 'img':
            return processImgXmlElement(element, env);
        default: {
            const results = await processXmls(element.children, env);
            return {
                value: {
                    name: element.name,
                    ...buildNodeFields(element, env),
                    children: results.map(r => r.value),
                },
                diags: results.reduce(
                    (ds, r) => r.diags ? [...ds, ...r.diags] : ds,
                    [] as Diagnostic[],
                ),
            };
        }
    }
}

async function processImgXmlElement(element: XmlElement, env: Env): Promise<Success<BooqNode>> {
    const { src } = element.attributes;
    if (!src) {
        return {
            value: {
                name: 'img',
                ...buildNodeFields(element, env),
            },
            diags: [{
                diag: 'empty src',
                data: { xml: xml2string(element) },
            }],
        };
    } else if (src.match(/\.png|jpg|jpeg|gif$/)) {
        const buffer = await env.imageResolver(src);
        if (buffer) {
            return {
                value: {
                    node: 'image',
                    image: {
                        image: 'base64',
                        base64: Buffer.from(buffer).toString('base64'),
                    },
                    ...buildNodeFields(element, env),
                },
            };
        } else {
            return {
                value: { node: 'ignore' },
                diags: [{
                    diag: `Couldn't load image: ${src}`,
                }],
            };
        }
    } else if (src.match(/^www\.[^.]+\.com/)) {
        return {
            value: {
                name: 'img',
                ...buildNodeFields(element, env),
            },
            diags: [{
                diag: 'external image',
            }],
        };
    } else {
        return {
            value: {
                name: 'img',
                ...buildNodeFields(element, env),
            },
            diags: [{
                diag: 'unsupported image',
                data: { src },
            }],
        };
    }
}

function buildNodeFields(xml: XmlElement, env: Env) {
    const result: Pick<BooqElementNode, 'id' | 'attrs'> = {};
    const { id, ...rest } = xml.attributes;
    if (id !== undefined) {
        result.id = fullId(id, env.filePath);
    }
    if (Object.keys(rest).length > 0) {
        result.attrs = rest;
    }
    return result;
}

function fullId(id: string, filePath: string) {
    return `${filePath}/${id}`;
}
