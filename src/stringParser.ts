export type ParserResult<T> = {
    success: true,
    value: T,
    next: string,
} | {
    success: false,
};

export type Parser<T> = (input: string) => ParserResult<T>;

export function regex(re: RegExp): Parser<string> {
    re = new RegExp('^' + re.source, 'i');
    return input => {
        const match = input.match(re);
        if (match) {
            return {
                success: true,
                value: match[0],
                next: input.substr(match[0].length),
            };
        } else {
            return { success: false };
        }
    };
}

export function sequence<T1, T2>(p1: Parser<T1>, p2: Parser<T2>): Parser<[T1, T2]>;
export function sequence<T1, T2, T3>(p1: Parser<T1>, p2: Parser<T2>, p3: Parser<T3>): Parser<[T1, T2, T3]>;
export function sequence<T>(...ps: Array<Parser<T>>): Parser<T[]> {
    return input => {
        const values: T[] = [];
        for (const p of ps) {
            const result = p(input);
            if (!result.success) {
                return result;
            }
            values.push(result.value);
            input = result.next;
        }
        return {
            success: true,
            value: values,
            next: input,
        };
    };
}

export function choice<T>(...ps: Array<Parser<T>>): Parser<T> {
    return input => {
        for (const p of ps) {
            const result = p(input);
            if (result.success) {
                return result;
            }
        }
        return { success: false };
    };
}

export function project<T, U>(p: Parser<T>, proj: (t: T) => U): Parser<U> {
    return input => {
        const result = p(input);
        if (result.success) {
            return {
                success: true,
                value: proj(result.value),
                next: result.next,
            };
        } else {
            return { success: false };
        }
    };
}
