// region[Imports]

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import * as rd from "readline";
import * as crypto from "crypto";


// endregion[Imports]

export async function sleep (ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

export async function* walk (directory_path: fs.PathLike): AsyncGenerator<string> {
    const dir = await fs.promises.opendir(directory_path);
    for await (const dirent of dir) {
        dirent.path = path.join(directory_path.toString(), dirent.name);

        if (dirent.isFile()) {
            yield dirent.path;
        } else if (dirent.isDirectory()) {
            for await (const sub_path of walk(dirent.path)) {
                yield sub_path;
            }
        }
    }
}

export async function* walk_uris (directory_path: fs.PathLike): AsyncGenerator<vscode.Uri> {
    for await (const file_path of walk(directory_path)) {
        yield vscode.Uri.file(file_path);
    }
}

export function is_strict_relative_path (path_1: string, path_2: string): boolean {
    const rel_path = path.relative(path_1, path_2);

    return rel_path !== undefined && !rel_path.startsWith("..") && !path.isAbsolute(rel_path);
}

export function get_base_workspace_folder (): vscode.WorkspaceFolder | undefined {
    return vscode.workspace.workspaceFolders?.at(0);
}

export function is_inside_workspace (): boolean {
    return get_base_workspace_folder() !== undefined;
}

export function convert_to_case_insensitive_glob_pattern (in_pattern: string): string {
    const new_pattern_chars: string[] = [];

    const non_letters: string = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~" + "0123456789";
    const ascii_letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    for (let char of in_pattern) {
        if (non_letters.includes(char)) {
            new_pattern_chars.push(char);
        } else {
            new_pattern_chars.push("[");
            new_pattern_chars.push(char.toUpperCase());
            new_pattern_chars.push(char.toLowerCase());
            new_pattern_chars.push("]");
        }
    }

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
            if (last_part === undefined) {
                throw Error("Cannot multiply with no previous part");
            }

            for (let i = 0; i < Number(_match.replace(/\*/m, "").trim()); i++) {
                parts.push(last_part);
            }
        } else if (_match === "+") {
        } else {
            last_part = _match.trim().replace(/^["']/gm, "").replace(/["']$/gm, "");
            parts.push(last_part);
        }
    }

    return parts.join("");
}

export function make_auto_pretty_name (in_name: string): string {
    const words: string[] = in_name.split(/[\-\_]+/gm);

    const capitalized_words: string[] = words.map((word) => {
        return word[0].toUpperCase() + word.substring(1);
    });

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
    terabyte: 1099511627776
} as const;

type _ByteUnit = "B" | "kB" | "mB" | "gB" | "tB" | "Byte" | "Bytes" | "Kilobyte" | "Kilobytes" | "Megabyte" | "Megabytes" | "Gigabyte" | "Gigabytes" | "Terabyte" | "Terabytes";

type ByteUnit = `${_ByteUnit}` | Lowercase<`${_ByteUnit}`> | Uppercase<`${_ByteUnit}`>;

export function human_to_bytes (amount: number, unit: ByteUnit) {
    const factor = BYTE_SIZE_MULTIPLIER[unit.toLowerCase().trim().replace(/s?$/gm, "")];

    return Math.round(amount * factor);
}

export function bytes_to_human (bytes: number, decimals: number = 2) {
    if (!+bytes) { return '0 Bytes'; }

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'kB', 'mB', 'gB', 'tB', 'pB', 'eB', 'zB', 'yB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
export class TextLineLike implements vscode.TextLine {
    readonly text: string;
    readonly lineNumber: number;

    private _range: vscode.Range | undefined;
    private _rangeIncludingLineBreak: vscode.Range | undefined;
    private _firstNonWhitespaceCharacterIndex: number | undefined;

    constructor (text: string, line_number: number) {
        this.text = text;
        this.lineNumber = line_number;
    }

    public get text_with_line_break (): string {
        return this.text + "\n";
    }

    public get isEmptyOrWhitespace (): boolean {
        return this.text.trim().length <= 0;
    }

    public get range (): vscode.Range {
        if (this._range === undefined) {
            this._range = new vscode.Range(this.lineNumber, 0, this.lineNumber, this.text.length - 1);
        }
        return this._range;
    }

    public get rangeIncludingLineBreak (): vscode.Range {
        if (this._rangeIncludingLineBreak === undefined) {
            this._rangeIncludingLineBreak = new vscode.Range(this.lineNumber, 0, this.lineNumber, this.text_with_line_break.length - 1);
        }
        return this._rangeIncludingLineBreak;
    }

    public get firstNonWhitespaceCharacterIndex (): number {
        if (this._firstNonWhitespaceCharacterIndex === undefined) {
            const _index = this.text.search(/[^\s]/gm);
            this._firstNonWhitespaceCharacterIndex = _index === -1 ? this.text.length - 1 : _index;
        }
        return this._firstNonWhitespaceCharacterIndex;
    }
}

export async function* iter_file_lines (in_file: string, include_newline: boolean = false): AsyncGenerator<TextLineLike> {

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
        }
    } finally {
        reader.close();
        stream.close();
    }
}

export async function* iter_text_document_lines (in_document: vscode.TextDocument, include_newline: boolean = false): AsyncGenerator<TextLineLike> {
    for (let line_number = 0; line_number < in_document.lineCount; line_number++) {
        const vscode_text_line = in_document.lineAt(line_number);
        yield new TextLineLike(vscode_text_line.text, vscode_text_line.lineNumber);
    }
}



export async function* iter_file_lines_read_at_once (in_file: string, include_newline: boolean = false): AsyncGenerator<TextLineLike> {
    const split_regex = include_newline ? /^/gm : /\r?\n/gm;
    let line_number = 0;
    for (const line of (await fs.readFile(in_file, "utf-8")).split(split_regex)) {
        yield new TextLineLike(!include_newline ? line : line + "\n", line_number);
        line_number++;
    }
}

export interface LineIterOptions {
    max_single_read_size?: number;
}

const DEFAULT_MAX_SINGLE_READ_SIZE: number = human_to_bytes(2.5, "mB");



export async function* iter_file_lines_best_algo (in_file: string, include_newline: boolean = false, options: LineIterOptions = {}): AsyncGenerator<TextLineLike> {
    const generator_function = (await fs.stat(in_file)).size <= (options.max_single_read_size || DEFAULT_MAX_SINGLE_READ_SIZE) ? iter_file_lines_read_at_once : iter_file_lines;

    for await (const line of generator_function(in_file, include_newline)) {
        yield line;
    }
}

export const median = (arr: number[]): number | undefined => {
    if (!arr.length) {
        return undefined;
    }
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export const better_round = (in_number: number, n_digits: number = 0) => {
    const multiplier = 10 ** n_digits;

    return Math.round(in_number * multiplier) / multiplier;
};

export function sort_file_paths (first_path: string, second_path: string) {
    function compare_parts_length (in_file_1: string, in_file_2: string) {
        const in_file_1_parts = in_file_1.split(/\/|\\{1,2}/g);
        const in_file_2_parts = in_file_2.split(/\/|\\{1,2}/g);

        return in_file_1_parts.length - in_file_2_parts.length;
    }

    const first_path_normalized = path.normalize(first_path);
    const second_path_normalized = path.normalize(second_path);

    return path.dirname(first_path_normalized).localeCompare(path.dirname(second_path_normalized)) || compare_parts_length(first_path_normalized, second_path_normalized);
}


export interface FileHashOptions {

    algorithm?: 'md4' | 'md5' | 'ripemd160' | 'sha1' | 'sha224' | 'sha256' | 'sha384' | 'sha512' | 'sha512-256';

}

export async function file_hash (file_path: string, options: FileHashOptions = {}) {


    options.algorithm = options.algorithm || "md5";




    const result = await new Promise((resolve, reject) => {
        const hash = crypto.createHash(options.algorithm!);
        const stream = fs.createReadStream(file_path);

        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (error) => reject(error));
    });


    return result;
}


