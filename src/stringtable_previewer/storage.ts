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



        const uri = vscode.Uri.file(this.file_path)
        const text = (await vscode.workspace.fs.readFile(uri)).toString();


        const loc_data = get_location(text, this.key_name)

        return new vscode.Location(uri, new vscode.Position(loc_data[0], loc_data[1]))

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
        // text.appendMarkdown(`\n\n-------\n\n\n`);
        // text.appendMarkdown(`- $(file-code) [${file_text}](${vscode.Uri.file(this.file_path)})\n`);



        // text.appendMarkdown(`- $(key) ${this.key_name}\n`)
        // text.appendMarkdown(`- $(file-code) [${file_text}](${vscode.Uri.file(this.file_path)})\n`);
        // text.appendMarkdown(`- $(record-small) ${this.package_name}\n`);

        // if (this.container_name) { text.appendMarkdown(`- $(database) ${this.container_name}\n`) };



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




    constructor(file_path: string) {
        super();
        this.file_path = path.format(path.parse(file_path.toString()));


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


};


export class StringTableDataStorage {

    private data: Array<StringtableData>;


    constructor() {
        this.data = new Array<StringtableData>;


    };


    public async load_data(): Promise<void> {

        async function _load_from_file(in_file: vscode.Uri): Promise<StringtableFileData> {
            const _stringtable_data = new StringtableFileData(in_file.fsPath);
            try {
                for (let entry of await parse_xml_file_async(in_file)) {
                    _stringtable_data.add_entry(entry);
                };
            } catch (error) {
                console.warn(`Error occured while processing Stringtable file ${in_file.fsPath}! ${error}`);
                vscode.window.showErrorMessage(`Error occured while processing Stringtable file '${in_file.fsPath}'! ---------------> ${error}`)

            };
            return _stringtable_data
        };



        this.data = Array.from(await Promise.all((await vscode.workspace.findFiles("**/Stringtable.xml")).map(_load_from_file)));

    };



    public async get_entry(key: string, file: string) {



        for (let _data of this.data) {
            if (!_data.is_responsible(file)) continue;
            let entry = await _data.get_entry(key);
            if (entry) {
                return entry;
            };

        };
    };


    clear() {

        this.data = new Array<StringtableData>();
    };

};



