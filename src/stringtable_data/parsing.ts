import * as xml2js from "xml2js";
import * as vscode from 'vscode';

import * as fs from 'fs';

import * as path from "path";

import { StringtableEntry } from "./storage";


export function get_location(full_text: string, target_text: string): number[] {

    const match_index = full_text.search(new RegExp(String.raw`(?<=\<Key ID=\")${target_text}(?=\"\>)`, "m"))


    const sub_text: string = full_text.substring(0, match_index)
    const sub_text_lines = sub_text.split(/\r?\n/m)
    const line_num = sub_text_lines.length - 1

    const char_num = sub_text_lines.pop()!.length


    return [line_num, char_num, target_text.length];
}

export async function parse_xml_file_async(file: vscode.Uri) {
    const xml_text = (await vscode.workspace.fs.readFile(file)).toString();
    let all_keys = new Array<StringtableEntry>();

    const result = await xml2js.parseStringPromise(xml_text)
    for (let _package of result.Project.Package) {
        for (let container of _package.Container) {
            if (!container.Key) {
                continue;
            }
            for (let key of container.Key) {
                const _id: string = key.$.ID;
                const _value: string = key.Original[0]

                const text_pos = get_location(xml_text, _id);



                all_keys.push(new StringtableEntry(_id, _value, _package.$.name, file.fsPath, container.$.name));
            }
        }

    }

    return all_keys;
};