// region[Imports]

import * as vscode from 'vscode';
import { parse_xml_file_async, get_location, add_to_stringtable_file, parse_stringtable_locations, FoundKey } from "./parsing";

import * as utils from "#utilities";

import * as path from "path";


import * as fs from "fs-extra";

import * as utilities from "../../utilities";


import AsyncLock from "async-lock";

import { StringtableDataLoadedEvent } from "typings/general";

import * as crypto from "crypto";

import sqlite3 from 'sqlite3';
import * as sqlite from 'sqlite';

import AvailableData from "./data";
import { FreeCommand, AbstractCommand } from "#bases";
// endregion[Imports]




const DB_BUILD_SQL_SCRIPT_PATH = AvailableData.get_resource("builtin_arma_stringtable_data.sql")!;



const ENTRY_QUERY = `SELECT
    EXISTS (
        SELECT
            *
        FROM
            StringtableKeyHashes skh
        WHERE
            skh.key_hash=upper(?)
    ) AS does_exists;`;




export interface StringtableEntryInterface {
    key_name: string;
    readonly is_builtin: boolean;
    exact_key_name: string;
    standardized_name: string;


    text: string;
    package_name: string;
    file_path: string;
    placeholder: ReadonlyArray<string>;
    has_translations: boolean;
    usage_locations: FoundKey[];
    [Symbol.toStringTag]: string;

    get_location (): Promise<vscode.Location | undefined>;
    get_hover_text (): vscode.MarkdownString;
    add_usage_location (found_key: FoundKey): Promise<void>;

};





export class StringtableEntry implements StringtableEntryInterface {

    key_name: string;
    text: string;
    package_name: string;
    file_path: string;
    placeholder: ReadonlyArray<string>;
    container_name?: string | undefined;
    has_translations: boolean;
    usage_locations: FoundKey[];
    readonly is_builtin: boolean;
    protected _location?: vscode.Location | undefined;
    protected _exact_key_name?: string | undefined;


    constructor (key_name: string,
        text: string,
        package_name: string,
        file_path: string,
        container_name?: string | undefined,
        exact_key_name?: string,
        location?: vscode.Location,
        has_translations: boolean = false) {

        this.key_name = key_name;
        this.text = text;
        this.package_name = package_name;
        this.container_name = container_name;
        this.file_path = path.format(path.parse(file_path.toString()));
        this.placeholder = Array.from(this.text.matchAll(/%\d+/gm)).map((value) => { return value[0]; });
        this._exact_key_name = exact_key_name;
        this.is_builtin = false;
        this._location = location;
        this.has_translations = has_translations;
        this.usage_locations = [];
    };

    public get standardized_name (): string {
        return this.key_name.toUpperCase();
    }


    public get exact_key_name (): string {
        if (!this._exact_key_name) {
            return this.key_name;
        };
        return this._exact_key_name;
    }


    async add_usage_location (found_key: FoundKey): Promise<void> {
        for (const existing_found_key of this.usage_locations) {
            if ((existing_found_key.relative_path === found_key.relative_path)
                && (existing_found_key.start_line === found_key.start_line)
                && (existing_found_key.start_char === found_key.start_char)) {
                return;
            }
        }
        this.usage_locations.push(found_key);
    };


    async get_location (): Promise<vscode.Location | undefined> {


        if (!this._location) {


            const start_regex = new RegExp(String.raw`(?<=\<Key ID=\")${this.key_name}(?=\"\>)`, "mi");
            const end_regex = /\<\/Key\>/mi;

            if (!await fs.exists(this.file_path)) { return; }
            let pos_start: vscode.Position | undefined = undefined;
            let pos_end: vscode.Position | undefined = undefined;

            for await (const _line of utils.iter_file_lines_best_algo(this.file_path)) {
                const line = _line.text;
                const line_num = _line.lineNumber;

                if ((pos_start) && (pos_end)) { break; }

                if (!pos_start) {
                    let _start_index = line.search(start_regex);

                    if (_start_index === -1) { continue; }

                    pos_start = new vscode.Position(line_num, _start_index - 9);



                } else {
                    let _end_index = line.search(end_regex);

                    if (_end_index === -1) { continue; }

                    pos_end = new vscode.Position(line_num, _end_index);



                };
            };
            if ((pos_start) && (pos_end)) {


                this._location = new vscode.Location(vscode.Uri.file(this.file_path), new vscode.Range(pos_start, pos_end));
            };


        };




        return this._location;

    };

    get_hover_text (): vscode.MarkdownString {
        const text = new vscode.MarkdownString("", true);
        const root_workspace_folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.at(0);
        let file_text: string;
        let file_link: string;

        if (root_workspace_folder) {
            file_text = path.relative(root_workspace_folder.uri.fsPath, this.file_path);
            file_link = `[${file_text}](${vscode.Uri.file(this.file_path)})`;

            if (!fs.existsSync(file_text)) {
                file_text = this.file_path.toString();
                file_link = `\`${this.file_path}\``;

            };

        } else {
            file_text = this.file_path.toString();
            file_link = `\`${this.file_path}\``;

        };

        const string_value: string = this.text.replace(/<br\/>/gm, "\n").replace(/%\d+/gm, "**`$&`**");

        text.appendMarkdown(string_value);

        text.appendMarkdown(`\n\n-------\n\n\n`);

        text.appendMarkdown(`$(file-code) ${file_link}$(arrow-small-right)`);
        text.appendMarkdown(`$(record-small) \`${this.package_name}\`$(arrow-small-right)`);
        if (this.container_name) { text.appendMarkdown(`$(database) \`${this.container_name}\`$(arrow-small-right)`); };
        text.appendMarkdown(`$(key) \`${this.key_name}\``);
        if (this.is_builtin) {


            text.appendMarkdown(`\n\n$(info) **__ARMA 3 BUILTIN__** $(info)`);

        };
        text.appendMarkdown(`\n\n-------\n\n\n`);
        if (this.placeholder.length > 0) {
            text.appendMarkdown(`Placeholder: ${this.placeholder.length} ` + "(" + this.placeholder.map((value) => { return `\`${value}\``; }).join(", ") + ")");
        } else {
            text.appendMarkdown(`Placeholder: ${this.placeholder.length} `);

        };





        return text;

    };
    get [Symbol.toStringTag] () {

        return `${this.constructor.name}(${this.package_name}, ${this.container_name}, ${this.key_name})`;
    };
};



export class BuiltinStringtableEntry implements StringtableEntryInterface {
    key_name: string;
    text: string;
    package_name: string;
    file_path: string;
    placeholder: ReadonlyArray<string>;
    has_translations: boolean;
    usage_locations: FoundKey[] = [];
    readonly is_builtin: boolean;
    protected _exact_key_name?: string | undefined;


    constructor (key_name: string, exact_key_name?: string) {
        this.key_name = key_name;
        this._exact_key_name = exact_key_name;
        this.is_builtin = true;
        this.text = "ARMA 3 BUILTIN";
        this.package_name = "";
        this.file_path = "";
        this.placeholder = [];
        this.has_translations = false;
    }

    public get standardized_name (): string {
        return this.key_name.toUpperCase();
    }

    public get exact_key_name (): string {
        if (!this._exact_key_name) {
            return this.key_name;
        };
        return this._exact_key_name;
    }


    set_location (location?: vscode.Location): void {

    }


    async add_usage_location (found_key: FoundKey): Promise<void> {

    };
    async get_location (): Promise<vscode.Location | undefined> {
        return undefined;
    };

    get_hover_text (): vscode.MarkdownString {
        const text = new vscode.MarkdownString("", true);

        text.appendMarkdown(`$(key) \`${this.exact_key_name}\``);
        text.appendMarkdown(`\n\n---\n\n`);
        text.appendMarkdown(`$(info) **__ARMA 3 BUILTIN__** $(info)`);
        return text;
    }

    get [Symbol.toStringTag] () {

        return `${this.constructor.name}(${this.key_name})`;
    };
}

export class StringtableData {
    protected data: Map<string, StringtableEntry>;
    protected _name: string | undefined = undefined;

    icon?: vscode.ThemeIcon | vscode.Uri;

    constructor () {
        this.data = new Map<string, StringtableEntry>();
    };





    public get name (): string {
        return this._name || "";
    };


    protected _normalize_key (key: string): string {

        return key.trim().toLowerCase();
    };

    public async add_entry (entry: StringtableEntry): Promise<void> {


        const normalized_key: string = this._normalize_key(entry.key_name);


        this.data.set(normalized_key, entry);
    };

    public async get_entry (key: string): Promise<StringtableEntryInterface | undefined> {
        const normalized_key: string = this._normalize_key(key);
        return this.data.get(normalized_key);

    };

    public has_entry (key: string): boolean {
        const normalized_key: string = this._normalize_key(key);
        return this.data.has(normalized_key);
    }


    public is_responsible (in_file: string): boolean {
        return true;
    };


    public clear (): void {
        this.data = new Map<string, StringtableEntry>();
    };


    public async reload (): Promise<StringtableData> {
        return this;
    };

    get [Symbol.toStringTag] () {

        return this.constructor.name;
    };
};


export interface EntryQueryResult {

    key_name: string,
    text: string,
    container_name: string,
    package_name: string,
    file_path: string;

}

export class StringtableBuiltinData extends StringtableData {
    db_path: string;

    constructor (db_path: string) {
        super();
        this.db_path = path.normalize(db_path);
    };



    public get db_exists (): boolean {
        return fs.existsSync(this.db_path);
    }


    public async get_all_key_names (): Promise<string[]> {
        return [];


    };


    public async get_key_names_from_partial_key (partial_key: string): Promise<string[]> {
        return [];




    };

    public async reload (): Promise<StringtableData> {
        this.delete_db();
        await this.create_db();
        return this;
    };

    protected async create_db () {
        try {

            await fs.ensureDir(path.dirname(this.db_path));

        } catch (e) {
            console.error(`dir creation error ${e}`);
            return;
        }

        const conn = await sqlite.open({ filename: this.db_path, driver: sqlite3.Database, mode: sqlite3.OPEN_CREATE | sqlite3.OPEN_READWRITE | sqlite3.OPEN_FULLMUTEX });
        try {

            await conn.exec(await DB_BUILD_SQL_SCRIPT_PATH.read_text());
        } catch (e) {
            console.error(`db creation error ${e}`);


        } finally {
            await conn.close();
        }
    };

    protected async get_db_connection () {
        if (!await fs.exists(this.db_path)) {
            await this.create_db();
        }
        return await sqlite.open({ filename: this.db_path, driver: sqlite3.Database, mode: sqlite3.OPEN_READONLY | sqlite3.OPEN_FULLMUTEX });
    };


    protected async query_entry (key_name: string) {

        const db_connection = await this.get_db_connection();

        try {
            const normalized_key = this._normalize_key(key_name);

            const hashed_key: string = crypto.createHash("sha256").update(normalized_key, "utf8").digest("hex");

            const res = await db_connection.get(ENTRY_QUERY, hashed_key);


            const exists = res.does_exists as boolean;

            if (!exists) {

                return;
            };

            const result = new BuiltinStringtableEntry(key_name);



            return result;


        } finally {
            db_connection.close();
        }
    };

    public clear (): void {
        this.delete_db();

    }

    public async get_entry (key: string): Promise<BuiltinStringtableEntry | undefined> {
        return this.query_entry(key);

    };

    public has_entry (key: string): boolean {
        const res = this.query_entry(key);
        if (!res) { return false; }
        return true;
    }

    public delete_db (): void {
        if (this.db_exists) {
            fs.removeSync(this.db_path);
        }


    };


    async dispose (): Promise<void> {
        this.delete_db();
    };

    get [Symbol.toStringTag] () {

        return `${this.constructor.name}(${path.basename(this.db_path)})`;
    };
}

export class StringtableFileData extends StringtableData {
    readonly file_path: string;
    readonly uri: vscode.Uri;
    public all_container_names: Array<string>;
    public is_parseable: boolean;




    constructor (file: vscode.Uri | string) {
        super();
        this.uri = file instanceof vscode.Uri ? file : vscode.Uri.file(file);
        this.file_path = path.normalize(this.uri.fsPath);
        this.all_container_names = [];
        this.is_parseable = true;
    };



    public get name (): string {
        if (this._name === undefined) {
            this._name = this._determine_name(this.file_path);
        };

        return this._name;
    };
    public async get_key_names_from_partial_key (partial_key: string): Promise<string[]> {

        function any_parts_match (key_parts: string[], partial_key_parts: string[]): boolean {
            let res = key_parts.some((value) => partial_key_parts.some((_value) => value.startsWith(_value)));
            return res;
        };

        const possible_keys: string[] = [];
        for (const [key, entry] of this.data.entries()) {
            if (key.toLowerCase().startsWith(partial_key)) {
                possible_keys.push(entry.exact_key_name);
            };
        };


        return Array.from(new Set(possible_keys));

    };
    public async get_all_key_names (): Promise<string[]> {

        return Array.from(this.data.values()).map((value) => value.exact_key_name);

    }
    public get all_key_names (): string[] {
        return Array.from(this.data.keys());
    };

    public async get_all_items (): Promise<StringtableEntry[]> {

        return Array.from(this.data.values());
    }

    public get workspace_path (): string {
        return vscode.workspace.asRelativePath(this.uri, true);
    };

    protected _determine_name (in_path: string): string {

        const path_parts = in_path.split(path.sep);

        const _name = path_parts.slice(path_parts.indexOf("addons") + 1)[0];

        if (!_name) { return ""; }


        return _name;
    };


    public is_responsible (in_file?: string): boolean {
        if (!in_file) { return false; }
        return utilities.is_strict_relative_path(path.dirname(this.file_path), path.normalize(in_file.toString()));
    };

    public async insert_new_key (container_name: string, key_name: string, original_value: string): Promise<StringtableEntry | undefined> {

        try {
            await add_to_stringtable_file(this.uri, container_name, key_name, original_value);
            await this.reload();

        } catch (error) {
            console.error(error);
            return undefined;
        };

        return await this.get_entry(key_name);

    };

    public async reload (): Promise<StringtableFileData> {


        this.clear();
        this.all_container_names = [];
        this.is_parseable = true;
        try {

            const result = await parse_xml_file_async(this.uri);
            for (let entry of result.found_keys) {



                this.add_entry(entry);


            };
            this.all_container_names = Array.from(result.found_container_names);

        } catch (error) {

            vscode.window.showErrorMessage(`Error occured while processing Stringtable file '${this.file_path}'! ---------------> ${error}`);
            console.error(`Error occured while processing Stringtable file '${this.file_path}'! ---------------> ${error}`);
            this.is_parseable = false;
        };

        return this;
    };
    get [Symbol.toStringTag] () {

        return `${this.constructor.name}(${this.name}, ${this.workspace_path})`;
    };
};


export class StringTableDataStorage {
    icon_map: Map<string, vscode.ThemeIcon | vscode.Uri> = new Map([
        ["gear",
            new vscode.ThemeIcon("gear")],
        ["core",
            new vscode.ThemeIcon("circle-large-outline")],
        ["maps",
            new vscode.ThemeIcon("circuit-board")],
        ["logistics",
            new vscode.ThemeIcon("compare-changes")],
        ["jeroen_arsenal",
            new vscode.ThemeIcon("debug")],
        ["gui",
            new vscode.ThemeIcon("editor-layout")],
        ["garage",
            new vscode.ThemeIcon("home")],
        ["events",
            new vscode.ThemeIcon("symbol-event")],
        ["config_fixes",
            new vscode.ThemeIcon("symbol-constructor")]
    ]);

    private dynamic_data: Array<StringtableFileData>;
    private static_data: Array<StringtableBuiltinData>;
    private readonly lock: AsyncLock;
    private readonly _onDataLoadedEmitter: vscode.EventEmitter<StringtableDataLoadedEvent>;

    public readonly onDataLoaded: vscode.Event<StringtableDataLoadedEvent>;

    public readonly _onAllDataLoadedEmitter: vscode.EventEmitter<void>;
    public readonly onAllDataLoaded: vscode.Event<void>;

    public readonly _onUsageLocationAddedEmitter: vscode.EventEmitter<StringtableEntry>;
    public readonly onUsageLocationAdded: vscode.Event<StringtableEntry>;

    private undefined_cache: Set<string>;

    private context: vscode.ExtensionContext | undefined;


    public last_reloaded_at: number = 0;

    private is_updating: boolean = false;

    constructor () {
        this._onDataLoadedEmitter = new vscode.EventEmitter();
        this.onDataLoaded = this._onDataLoadedEmitter.event;
        this._onAllDataLoadedEmitter = new vscode.EventEmitter();
        this.onAllDataLoaded = this._onAllDataLoadedEmitter.event;
        this.lock = new AsyncLock();
        this.dynamic_data = [];
        this.static_data = [];
        this.undefined_cache = new Set<string>();
        this._onUsageLocationAddedEmitter = new vscode.EventEmitter();
        this.onUsageLocationAdded = this._onUsageLocationAddedEmitter.event;

    };


    public async get_all_key_names (): Promise<string[]> {
        const all_key_names: string[] = [];
        for (const _data of this.dynamic_data) {
            all_key_names.push(...await _data.get_all_key_names());

        };




        return Array.from(new Set(all_key_names));
    }



    public get all_stringtable_names (): string[] {

        return this.dynamic_data.map((value) => value.name);
    };



    public get all_stringtable_paths (): string[] {
        return this.dynamic_data.map((value) => value.file_path);
    };



    public get all_stringtable_file_data_items (): StringtableFileData[] {
        return Array.from(this.dynamic_data);
    }

    public async load_data (files: vscode.Uri[], priority: boolean = false): Promise<StringtableFileData[]> {
        const res = await this.lock.acquire("data", async () => {
            this.is_updating = true;
            try {
                const tasks: Promise<StringtableFileData>[] = [];
                const to_add: Array<StringtableFileData> = [];
                const _changed_files: StringtableFileData[] = [];


                const _dynamic_data_map: ReadonlyMap<string, StringtableFileData> = new Map<string, StringtableFileData>(this.dynamic_data.map((item) => [item.uri.path, item]));
                for (let file of files) {
                    let _existing_stringtable_data = _dynamic_data_map.get(file.path);

                    if (_existing_stringtable_data === undefined) {

                        _existing_stringtable_data = new StringtableFileData(file.fsPath);
                        _existing_stringtable_data.icon = this.icon_map.get(_existing_stringtable_data.name);
                        to_add.push(_existing_stringtable_data);
                    };
                    tasks.push(_existing_stringtable_data.reload());
                    _changed_files.push(_existing_stringtable_data);


                };
                this.dynamic_data = this.dynamic_data.concat(to_add);
                return await Promise.all(tasks).then((value) => { this._onDataLoadedEmitter.fire({ changed_files: _changed_files as ReadonlyArray<StringtableFileData> }); return value; });
            } finally {
                this.is_updating = false;
            }
        }, { skipQueue: priority, maxPending: 1000 });

        return res;
    };


    async find_all_stringtable_files (): Promise<vscode.Uri[]> {
        const files = (await vscode.workspace.findFiles("**/Stringtable.xml")).sort((a, b) => { return fs.statSync(b.fsPath).size - fs.statSync(a.fsPath).size; });

        return files;
    };

    private async load_static_data (): Promise<StringtableBuiltinData[]> {
        const db_path = path.join(this.context!.globalStorageUri.fsPath, "builtin_arma_stringtable_data.db");
        const static_data_item = new StringtableBuiltinData(db_path);
        await static_data_item.reload();
        return [static_data_item];

    };

    public async load_all (): Promise<void> {
        console.log(`loading all Stringtable-Data`);
        await this.clear();
        this.dynamic_data = new Array<StringtableFileData>().concat(await this.load_data(await this.find_all_stringtable_files(), true));
        this.static_data = await this.load_static_data();
        this._onAllDataLoadedEmitter.fire();
        this.last_reloaded_at = Date.now() / 1000;
    };

    public async get_data_item_for_file (file: vscode.Uri): Promise<StringtableFileData | undefined> {

        return this.dynamic_data.filter((value) => { return (path.normalize(value.uri.fsPath) === path.normalize(file.fsPath)) || (value.is_responsible(file.fsPath)); }).at(0);
    };
    public async get_data_item_for_name (name: string): Promise<StringtableFileData | undefined> {
        return this.dynamic_data.filter((value) => { return (value.name.toLowerCase() === name.toLowerCase()); }).at(0);
    };
    public async get_entry (key: string, file?: string): Promise<StringtableEntryInterface | undefined> {

        while (this.is_updating) {
            await utils.sleep(0.1 * 1000);
        }


        if (this.undefined_cache.has(key.toLowerCase())) { return; };
        try {



            let found_entry: StringtableEntryInterface | undefined;
            for (const _data of this.dynamic_data) {
                if (!_data.is_responsible(file)) { continue; }
                const entry = await _data.get_entry(key);
                if (entry) {
                    found_entry = entry;
                    break;
                };

            };
            if (!found_entry) {
                for (const _data of this.dynamic_data) {
                    const entry = await _data.get_entry(key);
                    if (entry) {
                        found_entry = entry;
                        break;
                    };

                }
            }
            if (!found_entry) {



                for (const _data of this.static_data) {
                    const entry = await _data.get_entry(key);
                    if (entry) {
                        found_entry = entry;
                        break;
                    };

                };

            };

            if (!found_entry) {
                this.undefined_cache.add(key.toLowerCase());

            }
            return found_entry;
        } catch (error) {
            console.error(error);
        };


    };


    public async get_possible_entries (partial_key: string, file?: string): Promise<string[]> {

        partial_key = partial_key.toLowerCase();
        const possible_entries: string[] = [];
        let dynamic_data = Array.from(this.dynamic_data);

        if (file) {
            dynamic_data = dynamic_data.sort((a, b) => Number(a.is_responsible(file)) - Number((b.is_responsible(file))));
        }
        for (let _data of dynamic_data) {

            possible_entries.push(...await _data.get_key_names_from_partial_key(partial_key));


        };



        return Array.from(new Set(possible_entries));
    };

    public async add_usage_location (found_key: FoundKey) {
        const entry = await this.get_entry(found_key.text, found_key.file);
        if (!entry) {
            return;
        }


        await entry.add_usage_location(found_key);
        this._onUsageLocationAddedEmitter.fire(entry);
    }

    public async clear (): Promise<void> {


        return await this.lock.acquire("data", async () => {

            this.dynamic_data = [];
            this.static_data = [];
            this.undefined_cache.clear();


        }, { skipQueue: true });

    };

    handle_on_git_branch_changed = async (uri: vscode.Uri) => {

        utilities.sleep(1 * 1000).then(() => this.load_all());
    };

    handle_on_stringtable_file_changed = async (uri: vscode.Uri) => {
        await this.load_data([uri]);



    };

    handle_on_stringtable_file_deleted = async (uri: vscode.Uri) => {

        await this.load_all();

    };


    on_stringtable_file_saved = async (document: vscode.TextDocument) => {
        if (path.basename(document.uri.fsPath).toLowerCase() !== "stringtable.xml") { return; }


        await this.load_data([document.uri]);
    };

    public async register (context: vscode.ExtensionContext): Promise<vscode.Disposable[]> {

        this.context = context;





        const disposables: vscode.Disposable[] = [];


        disposables.push(this._onDataLoadedEmitter);


        const git_watcher = vscode.workspace.createFileSystemWatcher(utilities.convert_to_case_insensitive_glob_pattern("**/.git/HEAD"), undefined, undefined, true);

        git_watcher.onDidChange(this.handle_on_git_branch_changed);
        git_watcher.onDidCreate(this.handle_on_git_branch_changed);

        disposables.push(git_watcher);

        const stringtable_watcher = vscode.workspace.createFileSystemWatcher(utilities.convert_to_case_insensitive_glob_pattern("**/stringtable.xml"));

        stringtable_watcher.onDidChange(this.handle_on_stringtable_file_changed);
        stringtable_watcher.onDidDelete(this.handle_on_stringtable_file_deleted);
        stringtable_watcher.onDidCreate(this.handle_on_stringtable_file_changed);

        disposables.push(stringtable_watcher);




        return disposables;



    };


    async dispose (): Promise<void> {
        await Promise.all(this.static_data.map((item) => { return item.dispose(); }));
        await this.clear();
    };



    get [Symbol.toStringTag] () {

        return `${this.constructor.name}(${this.all_stringtable_names.join(", ")})`;
    };
};


