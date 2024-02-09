
// region[Imports]


import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";

import * as rd from "readline";


// endregion[Imports]



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




export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));


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








export async function* iter_file_lines (in_file: string, include_newline: boolean = false): AsyncGenerator<string> {
    const stream = fs.createReadStream(in_file, "utf-8");

    const reader = rd.createInterface({ input: stream, crlfDelay: Infinity });




    if (include_newline) {
        for await (const line of reader) {
            yield line + "\n";
        }
    } else {
        for await (const line of reader) {
            yield line;
        }
    };





};


export async function* iter_text_document_lines (in_document: vscode.TextDocument, include_newline: boolean = false): AsyncGenerator<vscode.TextLine> {

    for (let line_number = 0; line_number < in_document.lineCount; line_number++) {
        yield in_document.lineAt(line_number);
    };
}
export async function* enumerate<T> (in_iterator: AsyncIterable<T> | Iterable<T>, start: number = 0): AsyncGenerator<[number, T]> {
    let _counter = start;

    if (Symbol.asyncIterator in in_iterator) {
        for await (const item of in_iterator) {
            yield [_counter, item];
            _counter++;

        };
    } else {
        for (const item of in_iterator) {
            yield [_counter, item];
            _counter++;
        };
    };
}

