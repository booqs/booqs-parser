import { parse, Rule, Declaration } from 'css';
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
    const rules: StyleRule[] = [];
    const diags: Diagnostic[] = [];
    const parsed = parse(css, {
        silent: true,
        source: fileName,
    });
    if (parsed.stylesheet?.parsingErrors?.length) {
        diags.push({
            diag: 'css parsing error',
            data: {
                errors: parsed.stylesheet.parsingErrors,
            },
        });
    }
    const parsedRules = parsed.stylesheet?.rules.filter(
        (r): r is Rule => r.type === 'rule'
    ) ?? [];
    for (const parsedRule of parsedRules) {
        const { value, diags: ruleDiags } = buildRule(parsedRule);
        diags.push(...ruleDiags);
        if (value) {
            rules.push(value);
        }
    }

    return {
        value: { rules },
        diags,
    };
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
                selector: 'some',
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