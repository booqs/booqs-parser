import {
    parse, Rule, Declaration, Charset, Media, AtRule, Comment,
} from 'css';
import { Result, combineResults, Diagnostic } from './result';
import { Selector, parseSelector } from './selectors';
import { filterUndefined } from 'booqs-core';

export type StyleDeclaration = {
    property: string,
    value: string | undefined,
};
export type StyleRule = {
    selector: Selector,
    content: StyleDeclaration[],
}
export type Stylesheet = {
    rules: StyleRule[],
};
export function parseCss(css: string, fileName: string): Result<Stylesheet> {
    const diags: Diagnostic[] = [];
    const parsed = parse(css, {
        silent: true,
        source: fileName,
    });
    // if (parsed.stylesheet?.parsingErrors?.length) {
    //     diags.push({
    //         diag: 'css parsing error',
    //         data: {
    //             errors: parsed.stylesheet.parsingErrors.map(
    //                 e => ({ ...e, message: undefined }),
    //             ),
    //         },
    //     });
    // }
    const parsedRules = parsed.stylesheet?.rules ?? [];
    const { value: rules, diags: rulesDiags } = processRules(parsedRules);
    diags.push(...rulesDiags);

    return {
        value: { rules },
        diags,
    };
}

function processRules(parsedRules: Array<Rule | Comment | AtRule>) {
    const rules: StyleRule[] = [];
    const diags: Diagnostic[] = [];
    for (const parsedRule of parsedRules) {
        switch (parsedRule.type) {
            case 'comment':
            case 'font-face':
                break;
            case 'charset': {
                const charset = (parsedRule as Charset).charset;
                if (charset !== '"utf-8"') {
                    diags.push({
                        diag: `unsupported charset: ${charset}`,
                    });
                }
                break;
            }
            case 'media': {
                const mediaRule = parsedRule as Media;
                if (mediaRule.media !== 'all') {
                    diags.push({
                        diag: `unsupported media rule: ${mediaRule.media}`,
                    });
                    break;
                }
                const fromMedia = processRules(mediaRule.rules ?? []);
                rules.push(...fromMedia.value);
                diags.push(...fromMedia.diags);
                break;
            }
            case 'rule': {
                const { value, diags: ruleDiags } = buildRule(parsedRule);
                diags.push(...ruleDiags);
                if (value) {
                    rules.push(value);
                }
                break;
            }
            default:
                diags.push({
                    diag: `unsupported css rule: ${parsedRule.type}`,
                });
                break;
        }
    }

    return {
        value: rules,
        diags,
    };
}

export function parseInlineStyle(style: string, fileName: string) {
    // TODO: use '*' selector
    const pseudoCss = `div {\n${style}\n}`;
    const { value, diags } = parseCss(pseudoCss, fileName);
    if (value) {
        return {
            value: value.rules,
            diags,
        };
    } else {
        return { diags };
    }
}

function buildRule(rule: Rule): Result<StyleRule> {
    const { value, diags } = combineResults(rule.selectors?.map(parseSelector) ?? []);
    const selectors = filterUndefined(value ?? []);
    if (selectors.length === 0) {
        return { diags };
    }

    return {
        value: {
            selector: {
                selector: 'or',
                selectors,
            },
            content: (rule.declarations ?? [])
                .filter((r): r is Declaration => r.type === 'declaration')
                .map(d => ({
                    property: d.property!,
                    value: d.value,
                })),
        },
        diags,
    };
}