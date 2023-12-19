// region[Imports]

import * as vscode from 'vscode';
import { parse_xml_file_async, get_location } from "./parsing";



import * as path from "path";


import * as fs from "fs";

import * as utilities from "../utilities";


// endregion[Imports]





export class StringtableEntry {

    key_name: string;
    text: string;
    package_name: string;
    file_path: string;
    container_name?: string | undefined;
    protected _location?: vscode.Location | undefined;



    constructor(key_name: string,
        text: string,
        package_name: string,
        file_path: string,
        container_name?: string | undefined) {

        this.key_name = key_name;
        this.text = text;
        this.package_name = package_name;
        this.container_name = container_name;
        this.file_path = path.format(path.parse(file_path.toString()));

    };


    async get_location(): Promise<vscode.Location | undefined> {

        if (!this._location) {

            const uri = vscode.Uri.file(this.file_path)


            const text = (await vscode.workspace.fs.readFile(uri)).toString();


            const match_index = text.search(new RegExp(String.raw`(?<=\<Key ID=\")${this.key_name}(?=\"\>)`, "mi"))

            const pre_sub_text: string = text.substring(0, match_index)

            const pre_sub_text_lines = pre_sub_text.split(/\r?\n/m)

            const start_line_num = pre_sub_text_lines.length - 1

            const start_char_num = pre_sub_text_lines.pop()!.length - 9

            const post_sub_text: string = text.substring(match_index)

            const end_match_index = post_sub_text.search(/\<\/Key\>/mi)

            const end_sub_text_lines = text.substring(0, match_index + end_match_index).split(/\r?\n/m)

            const end_line_num = end_sub_text_lines.length - 1

            const end_char_num = end_sub_text_lines.pop()!.length;

            this._location = new vscode.Location(uri, new vscode.Range(start_line_num, start_char_num, end_line_num, end_char_num))
        };

        return this._location

    };

    get_hover_text(): vscode.MarkdownString {
        const text = new vscode.MarkdownString("", true);
        const root_workspace_folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.at(0);
        let file_text: string;
        if (root_workspace_folder) {
            file_text = path.relative(root_workspace_folder.uri.fsPath, this.file_path);
        } else {
            file_text = this.file_path.toString();
        };
        text.appendText(this.text);

        text.appendMarkdown(`\n\n-------\n\n\n`);
        text.appendMarkdown(`$(file-code) [${file_text}](${vscode.Uri.file(this.file_path)})$(arrow-small-right)`);
        text.appendMarkdown(`$(record-small) \`${this.package_name}\`$(arrow-small-right)`)
        if (this.container_name) { text.appendMarkdown(`$(database) \`${this.container_name}\`$(arrow-small-right)`) };
        text.appendMarkdown(`$(key) \`${this.key_name}\`\n\n`)


        return text;

    };

};


class StringtableData {
    protected data: Map<string, StringtableEntry>;
    protected _name: string | undefined = undefined;

    constructor() {
        this.data = new Map<string, StringtableEntry>();
    };



    public get name(): string {
        return this._name || "";
    };


    private _normalize_key(key: string): string {

        return key.toLowerCase();
    };

    public async add_entry(entry: StringtableEntry): Promise<void> {


        const normalized_key: string = this._normalize_key(entry.key_name);


        this.data.set(normalized_key, entry);
    };

    public async get_entry(key: string): Promise<StringtableEntry | undefined> {
        const normalized_key: string = this._normalize_key(key);
        return this.data.get(normalized_key);

    };


    public is_responsible(in_file: string): boolean {
        return true;
    };
};

class StringtableFileData extends StringtableData {
    readonly file_path: string;
    readonly uri: vscode.Uri;




    constructor(file_path: string) {
        super();
        this.file_path = path.format(path.parse(file_path.toString()));
        this.uri = vscode.Uri.file(this.file_path);

    };

    public get name(): string {
        if (this._name === undefined) {
            this._name = this._determine_name(this.file_path);
        };

        return this._name
    };


    private _determine_name(in_path: string): string {

        const path_parts = in_path.split(path.sep);

        const _name = path_parts.slice(path_parts.indexOf("addons") + 1)[0];

        if (!_name) return "";


        return _name;
    };


    public is_responsible(in_file: string): boolean {
        return utilities.is_strict_relative_path(path.dirname(this.file_path), path.format(path.parse(in_file.toString())));
    };



    public async reload(): Promise<void> {
        this.data = new Map<string, StringtableEntry>();
        try {
            for (let entry of await parse_xml_file_async(this.uri)) {
                this.add_entry(entry);
            };
        } catch (error) {
            // console.warn(`Error occured while processing Stringtable file ${in_file.fsPath}! ${error}`);
            vscode.window.showErrorMessage(`Error occured while processing Stringtable file '${this.file_path}'! ---------------> ${error}`)

        };



    };

};


export class StringTableDataStorage {

    private dynamic_data: Array<StringtableFileData>;
    private fixed_data: Array<StringtableData>;
    private is_loading: boolean;


    constructor() {
        this.dynamic_data = [];
        this.fixed_data = [];
        this.is_loading = false;

    };


    public async load_data(files: vscode.Uri[]): Promise<void> {
        await this.wait_on_is_loading();
        this.is_loading = true;
        try {
            const tasks: Promise<void>[] = [];
            const to_add: Array<StringtableFileData> = [];
            for (let file of files) {
                let _existing_stringtable_data = this.dynamic_data.filter((value) => { return (value.uri.fsPath === file.fsPath); })[0];

                if (_existing_stringtable_data === undefined) {
                    _existing_stringtable_data = new StringtableFileData(file.fsPath);
                    to_add.push(_existing_stringtable_data);
                }

                tasks.push(_existing_stringtable_data.reload())


            };
            this.dynamic_data = this.dynamic_data.concat(to_add);
            await Promise.all(tasks);
        } finally {
            this.is_loading = false;
        }
    };


    async all_stringtable_files(): Promise<vscode.Uri[]> {
        return await vscode.workspace.findFiles("**/Stringtable.xml")
    };

    public async load_all(): Promise<void> {
        await this.wait_on_is_loading();
        this.dynamic_data = [];
        this.fixed_data = [];
        await this.load_data(await this.all_stringtable_files())
    }

    public async get_entry(key: string, file: string) {

        await this.wait_on_is_loading();

        for (let _data of this.dynamic_data) {
            if (!_data.is_responsible(file)) continue;
            let entry = await _data.get_entry(key);
            if (entry) {
                return entry;
            };

        };

        for (let _data of this.fixed_data) {
            if (!_data.is_responsible(file)) continue;
            let entry = await _data.get_entry(key);
            if (entry) {
                return entry;
            };

        };
    };


    async wait_on_is_loading(): Promise<void> {
        while (this.is_loading === true) {
            await utilities.sleep(100);
        };
    };

    clear = () => {
        this.wait_on_is_loading().then(() => {
            this.dynamic_data = [];
            this.fixed_data = [];
        });
    };

};



