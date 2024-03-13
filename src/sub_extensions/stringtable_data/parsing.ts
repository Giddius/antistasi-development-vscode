// region[Imports]

import * as xml2js from "xml2js";
import * as vscode from 'vscode';
import * as fs from "fs-extra";
import * as path from "path";
import * as utils from "#utilities";
import { StringtableEntry } from "./storage";

// endregion[Imports]

interface FoundKeyJsonData {
    name: string;
    file: string;
    relative_path: string;
    start_line: number;
    start_char: number;
    end_line: number;
    end_char: number;
}

export class FoundKey {
    text: string;
    file: string;
    line_number: number;
    full_line?: string;


    private indexes: [number, number];
    private _range: vscode.Range | undefined;
    private _relative_path: string | undefined;
    private _uri: vscode.Uri | undefined;


    constructor (text: string, line_number: number, start_index: number, end_index: number, file: string, full_line?: string) {
        this.text = String(text);
        this.indexes = [start_index, end_index];
        this.line_number = line_number;
        this.file = path.resolve(file);
        this.full_line = String(full_line);
    };


    public get uri (): vscode.Uri {
        if (!this._uri) {
            this._uri = vscode.Uri.file(this.file);
        }
        return this._uri;
    }


    public get relative_path (): string {
        if (!this._relative_path) {
            this._relative_path = vscode.workspace.asRelativePath(this.file);
        }
        return this._relative_path;
    }

    public get range (): vscode.Range {
        if (!this._range) {
            this._range = new vscode.Range(this.line_number, this.indexes[0], this.line_number, this.indexes[1]);

        }
        return this._range;
    }

    public get start_line (): number {
        return this.line_number;
    }


    public get start_char (): number {
        return this.indexes[0];
    }


    public get end_line (): number {
        return this.line_number;
    }


    public get end_char (): number {
        return this.indexes[1];
    }


    public get json_data (): FoundKeyJsonData {

        return {
            name: this.text,
            file: this.file,
            relative_path: this.relative_path,
            start_line: this.start_line,
            start_char: this.start_char,
            end_line: this.end_line,
            end_char: this.end_char
        };

    };


    public get json_string_data (): string {
        return JSON.stringify(this.json_data);
    };





};
// export const STRINGTABLE_KEY_PATTERN = /"?\$?STR_[\w\d\_\-]+"? *\+?/gid;

// export const STRINGTABLE_KEY_PATTERN = /"?\$?STR_[\w\d\_\-]+"?/gid;
export const STRINGTABLE_KEY_PATTERN = /\$?STR_\w+\b/gid;



// const STRINGTABLE_CLEAN_PATTERN = /(^"?\$?)(.*?)("?$)/g;
const STRINGTABLE_CLEAN_PATTERN = /^\$/g;


async function* _get_all_matches (in_file: vscode.Uri, in_line: string, in_line_number: number) {



    function clean_text (in_text: string): string {
        return in_text.trim().replace(STRINGTABLE_CLEAN_PATTERN, ``);
    };




    for (const match of in_line.matchAll(STRINGTABLE_KEY_PATTERN)) {
        // if (match[0].endsWith("+")) { continue; };
        yield new FoundKey(clean_text(match[0]), in_line_number, match.indices![0][0], match.indices![0][1], in_file.fsPath, in_line);
    };



};
const BLOCK_COMMENT_BEGIN_REGEX = /\/\*/;
const BLOCK_COMMENT_END_REGEX = /\*\//;

const LINE_COMMENT_BEGIN_REGEX = /\/\//;

export async function* find_all_stringtable_keys (file: vscode.Uri): AsyncGenerator<FoundKey> {
    let inside_comment: boolean = false;



    for await (const line of utils.iter_file_lines_best_algo(file.fsPath)) {
        if (line.isEmptyOrWhitespace) {
            continue;
        }
        if (inside_comment) {
            const end_block_comment_index = line.text.search(BLOCK_COMMENT_END_REGEX);
            if (end_block_comment_index === -1) {
                // await utils.sleep(0);
                continue;
            } else {
                inside_comment = false;
                const sub_line = line.text.substring(end_block_comment_index);
                const filled_sub_line = " ".repeat(line.text.length - sub_line.length) + sub_line;
                yield* _get_all_matches(file, filled_sub_line, line.lineNumber);
                continue;
            }
        }

        const start_line_comment_index = line.text.search(LINE_COMMENT_BEGIN_REGEX);

        if (start_line_comment_index !== -1) {
            yield* _get_all_matches(file, line.text.substring(0, start_line_comment_index), line.lineNumber);
            continue;
        }

        const start_block_comment_index = line.text.search(BLOCK_COMMENT_BEGIN_REGEX);
        if (start_block_comment_index !== -1) {
            inside_comment = true;
            yield* _get_all_matches(file, line.text.substring(0, start_block_comment_index), line.lineNumber);
            continue;
        }

        if (line.text.trim().length <= 4) {
            continue;
        }

        yield* _get_all_matches(file, line.text, line.lineNumber);

    }

}





export function get_location (full_text: string, target_text: string): number[] {

    const match_index = full_text.search(new RegExp(String.raw`(?<=\<Key ID=\")${target_text}(?=\"\>)`, "m"));


    const sub_text: string = full_text.substring(0, match_index);
    const sub_text_lines = sub_text.split(/\r?\n/m);
    const line_num = sub_text_lines.length - 1;

    const char_num = sub_text_lines.pop()!.length;


    return [line_num, char_num, target_text.length];
}

export interface XMLResult {

    found_keys: ReadonlyArray<StringtableEntry>;
    found_container_names: ReadonlyArray<string>;


};


function _stringtable_encode_text (text: string): string {
    let mod_text = String(text);

    mod_text = mod_text.replace(/(\r)?(\\n|\n)/gm, "<br/>");
    mod_text = mod_text.replace(/&/gm, '&amp;');
    mod_text = mod_text.replace(/</gm, '&lt;');
    mod_text = mod_text.replace(/>/gm, '&gt;');
    return mod_text;

};

export async function add_to_stringtable_file (file: vscode.Uri, container_name: string, key_name: string, original_value: string): Promise<void> {


    key_name = key_name;
    original_value = _stringtable_encode_text(original_value).trim();
    const xml_text = await vscode.workspace.fs.readFile(file);
    const result = await xml2js.parseStringPromise(xml_text, { chunkSize: 1 * 1000, async: true });
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
            _package.Container.push({ "$": { "name": container_name }, "Key": [{ "$": { "ID": key_name }, "Original": [original_value] }] });
            was_inserted = true;
            break;
        };
    };

    let builder = new xml2js.Builder({ xmldec: { encoding: "utf-8", version: "1.0" } });
    await fs.writeFile(file.fsPath, builder.buildObject(result), "utf-8");

};

export async function parse_xml_file_async (file: vscode.Uri): Promise<XMLResult> {
    const location_data = await parse_stringtable_locations(file);
    const xml_text = await vscode.workspace.fs.readFile(file);
    let all_keys = new Array<StringtableEntry>();
    let all_container_names = new Set<string>();

    const result = await xml2js.parseStringPromise(xml_text, {});
    if ((!result) || (!result.Project) || (!result.Project.Package)) { return { found_keys: all_keys, found_container_names: Array.from(all_container_names).sort() }; }
    for (let _package of result.Project.Package) {
        if (!_package.Container) { continue; }

        for (let container of _package.Container) {
            await utils.sleep(0);
            all_container_names.add(container.$.name);
            if (!container.Key) { continue; }

            for (let key of container.Key) {

                const _id: string = key.$.ID;
                const _value: string = key.Original[0];

                const key_location = location_data.get(_id);
                if (!key_location) {
                    console.error(`location data NOT FOUND for ${_id} of file ${path.basename(path.dirname(file.fsPath))}`);
                }

                const has_translations = (Object.keys(key).filter((item) => { return ((item !== "$") && (item !== "Original")); }).length >= 1);
                all_keys.push(new StringtableEntry(_id, _value, _package.$.name, file.fsPath, container.$.name, undefined, key_location, has_translations));

            }


        }

    }

    return { found_keys: all_keys, found_container_names: Array.from(all_container_names).sort() };
};


export async function parse_stringtable_locations (file: vscode.Uri | string) {
    const file_path = path.normalize((typeof file === "string") ? file : file.fsPath);
    const file_uri = vscode.Uri.file(file_path);


    const name_location_data: Map<string, vscode.Location> = new Map();

    const start_regex = /(?<=\<Key ID=\")(?:STR|str)_\w+(?=\"\>)/gmdi;
    const end_regex = /\<\/Key\>/gmdi;

    let current_key: { name: string, start?: vscode.Position, end?: vscode.Position; } | undefined;
    let line_num = 0;
    // const document = await vscode.workspace.openTextDocument(file_uri);

    for await (const _line of utils.iter_file_lines_best_algo(file_path)) {
        const line = _line.text;
        // for await (const _line of utils.iter_text_document_lines(document)) {
        line_num = line_num + 1;
        if (!current_key) {
            const start_index = line.search(start_regex);

            if (start_index === -1) { continue; }

            current_key = { name: line.match(start_regex)!.at(0)!, start: new vscode.Position(line_num - 1, start_index - 9) };
        } else {
            const end_index = line.search(end_regex);

            if (end_index === -1) { continue; }

            current_key.end = new vscode.Position(line_num - 1, end_index + 6);
            name_location_data.set(current_key.name, new vscode.Location(file_uri, new vscode.Range(current_key.start!, current_key.end!)));
            current_key = undefined;
        }

    }




    return name_location_data as ReadonlyMap<string, vscode.Location>;
};




class ParsingContext {
    public uri: vscode.Uri;

    protected line_iterator: AsyncGenerator<vscode.TextLine>;
    public current_iterator_item?: IteratorResult<vscode.TextLine, any>;

    protected _current_char_index: number = 0;


    constructor (uri: vscode.Uri) {
        this.uri = uri;

        this.line_iterator = utils.iter_file_lines(this.uri.fsPath, true);
    }


    public get current_char_index (): number {
        return this._current_char_index;
    }


    public async set_char_index (index: number) {
        if (index >= this.current_line.length) {
            await this.advance_line();
        } else {
            this._current_char_index = index;
        }
    }



    public get is_done (): boolean {
        return (this.current_iterator_item!.done === true);
    }


    public get current_line_number (): number {
        return this.current_iterator_item!.value[0];
    }


    public get current_line (): string {
        return this.current_iterator_item!.value[1];
    }



    public async get_current_line_rest (): Promise<string> {
        if (!this.current_iterator_item) {
            await this.advance_line();
        }

        return this.current_line.substring(this.current_char_index);
    }


    async advance_line () {
        if (this.is_done) {
            throw Error(`Line iterator of ${this.uri.fsPath} already is finished.`);
        }

        this.current_iterator_item = await this.line_iterator.next();

        this._current_char_index = 0;
    }
}




abstract class AbstractParsingState {
    protected state_machine: ParsingStateMachine;


    constructor (state_machine: ParsingStateMachine) {
        this.state_machine = state_machine;
    }

}


class LineCommentState extends AbstractParsingState {

}


class BlockCommentState extends AbstractParsingState {

}


class ActiveCodeState extends AbstractParsingState {

}


class ParsingStateMachine {
    public context: ParsingContext;
    public states: { [index: string]: AbstractParsingState; };
    public current_state: AbstractParsingState;


    constructor (context: ParsingContext) {
        this.context = context;

        this.states = {
            block_comment: new BlockCommentState(this),
            line_comment: new LineCommentState(this),
            active_code: new ActiveCodeState(this)
        };

        this.current_state = this.states.active_code;
    }

    async *process () {
        if (!this.context.current_iterator_item) {
            await this.context.advance_line();
        }

    };


}

export async function* find_all_stringtable_keys_advanced (file: vscode.Uri): AsyncGenerator<FoundKey> {
    const context = new ParsingContext(file);

}