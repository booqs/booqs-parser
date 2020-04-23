import { parse, Rule, Declaration } from 'css';
import { Result } from 'booqs-core';

export type StyleRuleContent = {
    [p in string]?: string;
};
export type StyleRule = {
    selectors: string[],
    content: StyleRuleContent,
}
export type Stylesheet = {
    rules: StyleRule[],
};
export function parseCss(css: string): Result<Stylesheet> {
    const parsed = parse(css);
    const rules = parsed.stylesheet?.rules.filter(
        (r): r is Rule => r.type === 'rule'
    ) ?? [];
    const transformed: StyleRule[] = rules.map(r => ({
        selectors: r.selectors ?? [],
        content: r.declarations
            ?.filter((r): r is Declaration => r.type === 'declaration')
            .reduce<StyleRuleContent>(
                (c, d) => ({
                    ...c,
                    [d.property ?? '']: d.value,
                }),
                {}
            ) ?? {},
    }));

    return {
        value: {
            rules: transformed
        },
    };
}