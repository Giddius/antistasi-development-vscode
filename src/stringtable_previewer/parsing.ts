import * as xml2js from "xml2js";
import * as vscode from 'vscode';

import * as fs from 'fs';

import * as path from "path";

export class StringtableEntry {

    key_name: string;
    original_text: string;
    package_name: string;
    container_name: string | undefined;
    file: string | undefined;
    location: number[];



    constructor(key_name: string,
        original_text: string,
        package_name: string,
        location: number[],
        container_name?: string,
        file?: fs.PathLike) {

        this.key_name = key_name;
        this.original_text = original_text;
        this.package_name = package_name;
        this.location = location;
        this.container_name = container_name;
        this.file = file?.toString();
    };

};


function get_location(full_text: string, target_text: string): number[] {

    const match_index = full_text.search(new RegExp(String.raw`(?<=\<Key ID=\")${target_text}(?=\"\>)`, "m"))


    const sub_text: string = full_text.substring(0, match_index)
    const sub_text_lines = sub_text.split(/\r?\n/m)
    const line_num = sub_text_lines.length - 1

    const char_num = sub_text_lines.pop()!.length


    return [line_num, char_num, target_text.length];
}

export function parse_xml_file(file_path: fs.PathLike) {
    console.log(`file_path: ${file_path}`)
    const xml_text = fs.readFileSync(file_path, { encoding: "utf-8" });
    let all_keys: Map<string, StringtableEntry> = new Map();

    xml2js.parseString(xml_text, (err, result) => {
        for (let _package of result.Project.Package) {
            for (let container of _package.Container) {
                // console.dir(container)
                if (!container.Key) {
                    continue;
                }
                for (let key of container.Key) {
                    const _id: string = key.$.ID;
                    const _value: string = key.Original[0]


                    all_keys.set(_id, new StringtableEntry(_id, _value, _package.$.name, get_location(xml_text, _id), container.$.name, file_path));
                }
            }

        }
    })

    return all_keys;
};

