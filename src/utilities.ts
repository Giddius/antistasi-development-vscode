
// region[Imports]


import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";

import * as rd from "readline";
import { isAsyncFunction, isPromise } from "util/types";
import { AsyncFunc } from "mocha";


// endregion[Imports]

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));



export async function* walk (directory_path: fs.PathLike): AsyncGenerator<string> {


    const dir = await fs.promises.opendir(directory_path);
    for await (const dirent of dir) {
        dirent.path = path.join(directory_path.toString(), dirent.name);

        if (dirent.isFile()) {

            yield dirent.path;
        } else if (dirent.isDirectory()) {

            for await (const sub_path of walk(dirent.path)) {
                yield sub_path;
            };
        };



    };
};





export async function find_files_by_name (start_dir: fs.PathLike, file_name_to_search: string) {
    const found_files: string[] = [];


    for await (const file of walk(start_dir)) {
        if (file_name_to_search.toLowerCase() === path.basename(file).toLowerCase()) {
            found_files.push(file.toString());
        };

    };

    return found_files;

};

export function is_strict_relative_path (path_1: string, path_2: string): boolean {
    const rel_path = path.relative(path_1, path_2);

    return (rel_path !== undefined) && (!rel_path.startsWith('..')) && (!path.isAbsolute(rel_path));

};





export function get_base_workspace_folder (): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.at(0);
};


export function is_inside_workspace (): boolean {
    return (get_base_workspace_folder() !== undefined);
};




export function convert_to_case_insensitive_glob_pattern (in_pattern: string): string {

    const new_pattern_chars: string[] = [];

    const non_letters: string = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~' + '0123456789';
    const ascii_letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    for (let char of in_pattern) {
        if (non_letters.includes(char)) {
            new_pattern_chars.push(char);
        } else {
            new_pattern_chars.push("[");
            new_pattern_chars.push(char.toUpperCase());
            new_pattern_chars.push(char.toLowerCase());
            new_pattern_chars.push("]");
        }
    };



    return new_pattern_chars.join("");
}



export function resolve_sqf_string (in_string: string): string {

    const parts: string[] = [];
    const regex = /(((?<quotes>["']).*?\k<quotes>)|( ?\+ ?)|(\* ?\d+))/gm;

    let m;
    let last_part: string | undefined;

    while ((m = regex.exec(in_string)) !== null) {
        // This is necessary to avoid infinite loops with zero-width matches
        if (m.index === regex.lastIndex) {
            regex.lastIndex++;
        }

        // The result can be accessed through the `m`-variable.
        let _match = m[0].trim();


        if (/^\* ?\d+$/m.test(_match)) {
            if (last_part === undefined) { throw Error("Cannot multiply with no previous part"); }

            for (let i = 0; i < Number(_match.replace(/\*/m, "").trim()); i++) {
                parts.push(last_part);
            };
        } else if (_match === "+") {



        } else {
            last_part = _match.trim().replace(/^["']/gm, "").replace(/["']$/gm, "");
            parts.push(last_part);
        }


    };

    return parts.join("");

};




export function make_auto_pretty_name (in_name: string): string {


    const words: string[] = in_name.split(/[\-\_]+/gm);


    const capitalized_words: string[] = words.map((word) => { return word[0].toUpperCase() + word.substring(1); });



    return capitalized_words.join("-");
}



const BYTE_SIZE_MULTIPLIER: { [name: string]: number; } = {
    b: 1,
    kb: 1024,
    mb: 1048576,
    gb: 1073741824,
    tb: 1099511627776,

    byte: 1,
    kilobyte: 1024,
    megabyte: 1048576,
    gigabyte: 1073741824,
    terabyte: 1099511627776,

} as const;

type _ByteUnit = "B" | "kB" | "mB" | "gB" | "tB" | "Byte" | "Bytes" | "Kilobyte" | "Kilobytes" | "Megabyte" | "Megabytes" | "Gigabyte" | "Gigabytes" | "Terabyte" | "Terabytes";


type ByteUnit = `${_ByteUnit}` | Lowercase<`${_ByteUnit}`> | Uppercase<`${_ByteUnit}`>;

export function human_to_bytes (amount: number, unit: ByteUnit) {

    const factor = BYTE_SIZE_MULTIPLIER[unit.toLowerCase().trim().replace(/s?$/gm, "")];

    return Math.round(amount * factor);
}

export class TextLineLike implements vscode.TextLine {
    readonly text: string;
    readonly lineNumber: number;

    constructor (text: string, line_number: number) {
        this.text = text;
        this.lineNumber = line_number;
    }



    public get isEmptyOrWhitespace (): boolean {
        return (this.text.trim().length <= 0);
    }



    public get range (): vscode.Range {

        return new vscode.Range(this.lineNumber, 0, this.lineNumber, this.text.replace(/\r?\n$/gm, "").length - 1);

    }


    public get rangeIncludingLineBreak (): vscode.Range {

        return new vscode.Range(this.lineNumber, 0, this.lineNumber, (this.text.replace(/\r?\n$/gm, "") + "\n").length - 1);

    }

    public get firstNonWhitespaceCharacterIndex (): number {
        const _index = this.text.search(/[^\s]/gm);
        return (_index === -1) ? this.text.length - 1 : _index;
    }


}


export async function* iter_file_lines (in_file: string, include_newline: boolean = false): AsyncGenerator<vscode.TextLine> {


    const stream = fs.createReadStream(in_file, "utf-8");

    const reader = rd.createInterface({ input: stream });



    try {
        let line_number = 0;
        if (include_newline) {
            for await (const line of reader) {
                yield new TextLineLike(line + "\n", line_number);
                line_number++;

            }
        } else {
            for await (const line of reader) {

                yield new TextLineLike(line, line_number);
                line_number++;

            }
        };

    } finally {
        reader.close();
        stream.close();
    }



};


export async function* iter_text_document_lines (in_document: vscode.TextDocument, include_newline: boolean = false): AsyncGenerator<vscode.TextLine> {


    for (let line_number = 0; line_number < in_document.lineCount; line_number++) {
        await sleep(1);
        yield in_document.lineAt(line_number);
    };
}
export async function* enumerate<T> (in_iterator: AsyncIterable<T> | Iterable<T>, start: number = 0): AsyncGenerator<[number, T]> {

    let _counter = start;

    if (Symbol.asyncIterator in in_iterator) {
        for await (const item of in_iterator) {
            yield [_counter, item];
            _counter = _counter + 1;

        };
    } else {
        for (const item of in_iterator) {
            yield [_counter, item];
            _counter = _counter + 1;
        };
    };
}



export async function* iter_file_lines_read_at_once (in_file: string, include_newline: boolean = false): AsyncGenerator<vscode.TextLine> {

    const split_regex = (include_newline) ? /^/gm : /\r?\n/gm;
    let line_number = 0;
    for (const line of (await fs.readFile(in_file, "utf-8")).split(split_regex)) {
        yield new TextLineLike((!include_newline) ? line : line + "\n", line_number);
        line_number++;

    }

}



export interface LineIterOptions {
    max_single_read_size?: number;
}



const DEFAULT_MAX_SINGLE_READ_SIZE: number = human_to_bytes(1, "mB");

export async function* iter_file_lines_best_algo (in_file: string, include_newline: boolean = false, options: LineIterOptions = {}) {


    const generator_function = ((await fs.stat(in_file)).size <= (options.max_single_read_size || DEFAULT_MAX_SINGLE_READ_SIZE)) ? iter_file_lines_read_at_once : iter_file_lines;

    for await (const line of generator_function(in_file, include_newline)) {
        yield line;
    }
};

export const median = (arr: number[]): number | undefined => {
    if (!arr.length) { return undefined; }
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : ((s[mid - 1] + s[mid]) / 2);
};


export async function big_small_file_path_mix (in_paths: vscode.Uri[]): Promise<vscode.Uri[]> {
    const result: vscode.Uri[] = [];
    const median_size = Math.ceil(median(await Promise.all(in_paths.map(async (item) => { return (await fs.stat(item.fsPath)).size; })))! * 1.05);

    console.log(`median_size: ${median_size}`);

    const big_files = in_paths.filter((item) => (fs.statSync(item.fsPath).size > median_size)).sort((a, b) => fs.statSync(b.fsPath).size - fs.statSync(a.fsPath).size);
    const small_files = in_paths.filter((item) => (fs.statSync(item.fsPath).size <= median_size)).sort((a, b) => fs.statSync(b.fsPath).size - fs.statSync(a.fsPath).size);

    console.log(`first_big_file_size: ${fs.statSync(big_files.at(0)!.fsPath).size}`);
    console.log(`last_big_file_size: ${fs.statSync(big_files.at(-1)!.fsPath).size}`);

    console.log(`first_small_file_size: ${fs.statSync(small_files.at(0)!.fsPath).size}`);
    console.log(`amount in_paths: ${in_paths.length}, amount big_files: ${big_files.length}, amount small_files: ${small_files.length}, amount big and small files: ${big_files.length + small_files.length}`);

    while (true) {
        const big_file_to_add = big_files.pop();
        if (!big_file_to_add) { break; }
        result.push(big_file_to_add);
        const small_file_to_add = small_files.pop();
        if (!small_file_to_add) { break; }
        result.push(small_file_to_add);
    }

    if (big_files.length > 0) {
        result.push(...big_files);
    }

    if (small_files.length > 0) {
        result.push(...small_files);
    }



    return result;

}


