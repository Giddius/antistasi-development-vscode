
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";
import * as utilities from "../utilities";

// endregion[Imports]

const TOKENIZE_REGEX = /(\\\n|\r\n|>>|\/\*|\*\/|\|\||\/\/|!=|<=|>=|==|\n|\t|[\"\' =:\{\}\(\)\[\];/,\!\/\*\%\^\-\+<>])/gm;




export async function* raw_tokenize_sqf (text: string): AsyncGenerator<string> {
    const _split_regex = new RegExp(TOKENIZE_REGEX);
    for (const token of text.split(_split_regex)) {
        yield token;
    };
};



export async function* raw_tokenize_sqf_from_lines (lines: Iterable<string>): AsyncGenerator<string> {
    const _split_regex = new RegExp(TOKENIZE_REGEX);

    for (const line of lines) {
        for (const token of line.split(_split_regex)) {
            yield token;
        };

    };
};



export async function* tokenize_sqf (text: string): AsyncGenerator<string> { };
