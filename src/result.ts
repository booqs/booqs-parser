import { flatten } from 'booqs-core';

export type Diagnostic = {
    diag: string,
    data?: object,
};
export type Success<T> = {
    value: T,
    diags: Diagnostic[],
};
export type Failure = {
    value?: undefined,
    diags: Diagnostic[],
};

export type Result<T> = Success<T> | Failure;

export function combineResults<T>(results: Array<Result<T>>): Result<Array<T | undefined>> {
    return {
        value: results.map(r => r.value),
        diags: flatten(results.map(r => r.diags)),
    };
}

export type ResultGen<T> = Generator<Diagnostic, T | undefined>;
export function resultFromGen<T>(gen: ResultGen<T>): Result<T> {
    const diags: Diagnostic[] = [];
    let next = gen.next();
    while (!next.done) {
        diags.push(next.value);
        next = gen.next();
    }
    const last = next.value;
    if (last) {
        return { value: last, diags };
    } else {
        return { diags };
    }
}
export function genResult<T>(genFn: () => ResultGen<T>) {
    return resultFromGen(genFn());
}

export type ResultAsyncGen<T> = AsyncGenerator<Diagnostic, T | undefined>;
export async function resultFromAsyncGen<T>(gen: ResultAsyncGen<T>): Promise<Result<T>> {
    const diags: Diagnostic[] = [];
    let next = await gen.next();
    while (!next.done) {
        diags.push(next.value);
        next = await gen.next();
    }
    const last = next.value;
    if (last) {
        return { value: last, diags };
    } else {
        return { diags };
    }
}
export function genAsyncResult<T>(genFn: () => ResultAsyncGen<T>) {
    return resultFromAsyncGen(genFn());
}
