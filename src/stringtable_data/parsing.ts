import * as xml2js from "xml2js";
import * as vscode from 'vscode';

import * as fs from 'fs';

import * as path from "path";

import { StringtableEntry } from "./storage";


export function get_location (full_text: string, target_text: string): number[] {

    const match_index = full_text.search(new RegExp(String.raw`(?<=\<Key ID=\")${target_text}(?=\"\>)`, "m"));


    const sub_text: string = full_text.substring(0, match_index);
    const sub_text_lines = sub_text.split(/\r?\n/m);
    const line_num = sub_text_lines.length - 1;

    const char_num = sub_text_lines.pop()!.length;


    return [line_num, char_num, target_text.length];
}

class XMLResult {
    readonly xml_obj: any;
    readonly found_keys: StringtableEntry[];
    readonly found_container_names: string[];


    constructor (xml_obj: any, found_keys: StringtableEntry[], found_container_names: string[]) {
        this.xml_obj = xml_obj;
        this.found_keys = found_keys;
        this.found_container_names = found_container_names;
    };
};


function _stringtable_encode_text (text: string): string {
    let mod_text = String(text);

    mod_text = mod_text.replace(/\r?\n/gm, "<br/>");
    mod_text = mod_text.replace(/&/gm, '&amp;');
    mod_text = mod_text.replace(/</gm, '&lt;');
    mod_text = mod_text.replace(/>/gm, '&gt;');

    return mod_text;

};

export async function add_to_stringtable_file (file: vscode.Uri, container_name: string, key_name: string, original_value: string): Promise<void> {


    key_name = key_name;
    const xml_text = await vscode.workspace.fs.readFile(file);
    const result = await xml2js.parseStringPromise(xml_text);
    let was_inserted: boolean = false;
    for (let _package of result.Project.Package) {
        for (let container of _package.Container) {
            if (container.$.name === container_name) {
                container.Key.push({ "$": { "ID": key_name }, "Original": [original_value] });
                was_inserted = true;
                break;
            };
        };
        if (was_inserted === false) {
            _package.Container.push({ "$": { "name": container_name }, "Key": [{ "$": { "ID": key_name }, "Original": _stringtable_encode_text(original_value).trim() }] });
            was_inserted = true;
            break;
        };
    };

    let builder = new xml2js.Builder();
    fs.writeFileSync(file.fsPath, builder.buildObject(result), {});
    // await vscode.workspace.fs.writeFile(file, new TextEncoder().encode());

};

export async function parse_xml_file_async (file: vscode.Uri) {
    const xml_text = await vscode.workspace.fs.readFile(file);
    let all_keys = new Array<StringtableEntry>();
    let all_container_names = new Set<string>();

    const result = await xml2js.parseStringPromise(xml_text);
    for (let _package of result.Project.Package) {
        for (let container of _package.Container) {
            all_container_names.add(container.$.name);
            if (!container.Key) {
                continue;
            }

            for (let key of container.Key) {
                const _id: string = key.$.ID;
                const _value: string = key.Original[0];





                all_keys.push(new StringtableEntry(_id, _value, _package.$.name, file.fsPath, container.$.name));
            }
        }

    }

    return new XMLResult(result, all_keys, Array.from(all_container_names).sort());
};