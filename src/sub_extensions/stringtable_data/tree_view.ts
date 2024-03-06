
// region[Imports]

import * as path from "path";
import * as fs from "fs-extra";
import * as vscode from "vscode";
import * as general_typings from "typings/general";

import * as bases from "#bases";
import * as utils from "#utilities";

import { StringTableDataStorage, StringtableFileData, StringtableEntry } from "./storage";
import { FoundKey } from "./parsing";

// endregion[Imports]


interface ReloadEventData {
    model?: StringtableModel;
}

enum FilterType {
    ALL = "all",
    ONLY_NO_TRANSLATIONS = "if it has no translations",
    ONLY_PLACEHOLDER = "if it has placeholder",
    ONLY_NO_USAGE = "if it is used in the codebase"

}


export interface StringtableModel {
    name: string;
    extendable: boolean;
    visible: boolean;
    id: string;
    parent?: StringtableModel;
    icon?: string | vscode.Uri | vscode.ThemeIcon;
    value?: string;
    info?: string | vscode.MarkdownString;
    uri?: vscode.Uri;

    get_children (): Promise<StringtableModel[]>;
    hide (): void;
    show (): void;
}


const ENTRY_ICON = new vscode.ThemeIcon("key");

const CONTAINER_ICON = new vscode.ThemeIcon("type-hierarchy");



type FilterFunction = (item: StringtableFileModel | StringtableContainerModel | StringtableEntryModel | StringtableUsageLocationModel) => boolean;


export class StringtableUsageLocationModel implements StringtableModel {
    name: string;
    extendable: boolean;
    usage_location: FoundKey;
    entry_model: StringtableEntryModel;
    value?: string | undefined;
    uri: vscode.Uri;
    protected _visible: boolean;
    protected filter_function?: FilterFunction;

    constructor (usage_location: FoundKey, entry_model: StringtableEntryModel, filter_function?: FilterFunction) {
        this.usage_location = usage_location;
        this.entry_model = entry_model;
        this._visible = true;
        this.filter_function = filter_function;
        this.extendable = false;
        this.name = `${this.usage_location.relative_path}`;
        this.value = `Line: ${this.usage_location.start_line} Character: ${this.usage_location.start_char}`;
        this.uri = vscode.Uri.file(this.usage_location.file);
    }



    public get info (): string | vscode.MarkdownString | undefined {
        if (!this.usage_location.full_line) {
            return;
        }
        const text = new vscode.MarkdownString("", true);
        text.appendMarkdown(`- File: \`${this.usage_location.relative_path}\`\n- Line: \`${this.usage_location.start_line}\`\n---\n\n`);

        text.appendCodeblock(`\n${this.usage_location.full_line}\n\n`, "js");
        text.appendMarkdown(`---`);

        return text;
    }


    public get id (): string {
        return `${this.entry_model.id}.${this.usage_location.relative_path}-${this.usage_location.start_line}-${this.usage_location.start_char}`;
    }

    public get visible (): boolean {
        if (this.filter_function) {
            return this._visible && (this.filter_function(this));
        };
        return this._visible;
    }

    public get parent (): StringtableEntryModel {
        return this.entry_model;
    }
    async get_children (): Promise<StringtableModel[]> {
        return [];
    }
    hide () {
        this._visible = false;
    }

    show () {
        this._visible = true;
    }
}

export class StringtableEntryModel implements StringtableModel {
    public name;
    public extendable: boolean;
    public icon?: string | vscode.Uri | vscode.ThemeIcon | undefined;
    entry: StringtableEntry;
    protected _visible: boolean;

    protected parent_model: StringtableContainerModel | StringtableFileModel;
    protected filter_function?: FilterFunction;

    constructor (entry: StringtableEntry, parent_model: StringtableContainerModel | StringtableFileModel, filter_function?: FilterFunction) {
        this.entry = entry;
        this.parent_model = parent_model;
        this.name = entry.standardized_name;
        this.extendable = true;
        this._visible = true;
        this.icon = ENTRY_ICON;
        this.filter_function = filter_function;



    }



    public get parent (): StringtableContainerModel | StringtableFileModel {
        return this.parent_model;
    }


    public get info (): string | vscode.MarkdownString | undefined {
        return this.entry.get_hover_text();

    }


    public get id (): string {
        return `${this.name}`;
    }


    // public get value (): string {
    //     return ""
    // }


    public get visible (): boolean {
        if (this.filter_function) {
            return this._visible && (this.filter_function(this));
        };
        return this._visible;
    }

    hide () {
        this._visible = false;
    }

    show () {
        this._visible = true;
    }


    async get_children (): Promise<StringtableModel[]> {
        return this.entry.usage_locations.map((usage_location) => { return new StringtableUsageLocationModel(usage_location, this, this.filter_function); });

    }

    get [Symbol.toStringTag] () {

        return `${this.constructor.name}(${this.id})`;
    };

}

export class StringtableContainerModel implements StringtableModel {
    public name: string;
    public extendable: boolean;
    public icon?: string | vscode.Uri | vscode.ThemeIcon | undefined;
    protected file_model: StringtableFileModel;
    protected _visible: boolean;
    protected entries: StringtableEntryModel[];
    protected filter_function?: FilterFunction;


    constructor (name: string, file_model: StringtableFileModel, filter_function?: FilterFunction) {
        this.name = name;
        this.file_model = file_model;
        this.entries = [];
        this.extendable = true;
        this._visible = true;
        this.icon = CONTAINER_ICON;
        this.filter_function = filter_function;

    }


    public get info (): vscode.MarkdownString {
        const text = new vscode.MarkdownString("", true);
        text.appendMarkdown(`**Container** \`${this.name}\``);
        return text;
    }

    public get parent (): StringtableFileModel {
        return this.file_model;
    }


    public get id (): string {
        return `${this.file_model.id}.${this.name}`;
    }


    public get visible_entries (): StringtableEntryModel[] {
        return this.entries.filter((item) => { return (item.visible === true); });
    }

    public get visible (): boolean {
        return this._visible && (this.visible_entries.length > 0);
    }


    public get entry_map (): Map<string, StringtableEntryModel> {
        return new Map(this.entries.map((item) => { return [item.name.toLowerCase(), item]; }));
    }


    hide () {
        this._visible = false;
    }

    show () {
        this._visible = true;
    }

    async get_children (): Promise<StringtableModel[]> {
        return this.visible_entries;
    }






    add_entry (entry: StringtableEntry) {
        const entry_model = new StringtableEntryModel(entry, this, this.filter_function);
        this.entries.push(entry_model);
        return entry_model;
    }


    sort (entry_sort_func: (a: StringtableEntryModel, b: StringtableEntryModel) => number) {
        this.entries.sort(entry_sort_func);
    };

    get [Symbol.toStringTag] () {

        return `${this.constructor.name}(${this.id})`;
    };
}


export class StringtableFileModel implements StringtableModel {
    public name;
    public extendable: boolean;
    public icon?: string | vscode.Uri | vscode.ThemeIcon | undefined;
    public show_container: boolean;
    protected _visible: boolean;
    protected data: StringtableFileData;
    protected container: Map<string, StringtableContainerModel>;
    protected keys: Map<string, StringtableEntryModel>;
    protected filter_function?: FilterFunction;



    constructor (data: StringtableFileData, filter_function?: FilterFunction) {
        this.name = data.name;
        this.data = data;
        this.container = new Map();
        this.keys = new Map();
        this.extendable = true;
        this._visible = true;
        this.icon = data.icon;
        this.filter_function = filter_function;
        this.show_container = true;

    }


    public get id (): string {
        return this.name;
    }

    public get visible_container (): StringtableContainerModel[] {
        return Array.from(this.container.values()).filter((item) => { return (item.visible === true); });
    }


    public get visible_keys (): StringtableEntryModel[] {
        return Array.from(this.keys.values()).filter((item) => { return (item.visible === true); });
    }


    public get value (): string {
        return this.data.workspace_path;
    }

    public get visible (): boolean {
        return this._visible && (this.visible_container.length > 0);
    }

    hide () {
        this._visible = false;
    }

    show () {
        this._visible = true;
    }
    async get_children (): Promise<StringtableModel[]> {
        if (this.show_container === true) {
            return this.visible_container;
        } else {
            return this.visible_keys;
        }
    }


    get_container (container_name?: string, strict: boolean = false): StringtableContainerModel | undefined {
        container_name = container_name || "NO_CONTAINER";

        let container: StringtableContainerModel | undefined = this.container.get(container_name.toUpperCase());

        if (!container) {
            if (strict === true) {
                return;
            }
            container = new StringtableContainerModel(container_name, this, this.filter_function);
            this.container.set(container.name.toUpperCase(), container);
        };

        return container;

    }
    async sort (sort_funcs: { container_sort_func?: (a: StringtableContainerModel, b: StringtableContainerModel) => number; entry_sort_func?: (a: StringtableEntryModel, b: StringtableEntryModel) => number; }) {
        if (sort_funcs.container_sort_func) {
            const sorted_container = Array.from(this.container.values());
            sorted_container.sort(sort_funcs.container_sort_func);

            this.container = new Map(sorted_container.map((item) => { return [item.name.toUpperCase(), item]; }));
        }

        if (sort_funcs.entry_sort_func) {

            for (const container of this.container.values()) {
                container.sort(sort_funcs.entry_sort_func);
            }
        }
    }
    async load () {
        for (const entry of await this.data.get_all_items()) {
            const container = this.get_container(entry.container_name);

            const entry_model = container!.add_entry(entry);

            this.keys.set(entry_model.name.toUpperCase(), entry_model);
        }
    };
    get [Symbol.toStringTag] () {

        return `${this.constructor.name}(${this.id})`;
    };
}




export class StringTableTreeView implements vscode.TreeDataProvider<StringtableModel> {
    protected stringtables_data: StringTableDataStorage;
    protected models: StringtableFileModel[];
    protected filter_function?: FilterFunction;

    constructor (stringtables_data: StringTableDataStorage) {
        this.stringtables_data = stringtables_data;
        this.models = [];

        this.stringtables_data.onDataLoaded(() => this.reload());
        this.stringtables_data.onUsageLocationAdded((entry) => this.reload_entry(entry));
    }



    public get visible_models (): StringtableFileModel[] {
        return this.models.filter((item) => { return (item.visible === true); });
    }




    async getTreeItem (element: StringtableModel): Promise<vscode.TreeItem> {
        const tree_item = new vscode.TreeItem(element.name, (element.extendable) ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        tree_item.id = element.id;
        tree_item.iconPath = element.icon;
        tree_item.description = element.value;
        tree_item.tooltip = element.info;
        tree_item.resourceUri = element.uri;


        return tree_item;

    }

    async getChildren (element?: StringtableModel | undefined): Promise<StringtableModel[]> {

        if (!element) {
            return this.visible_models;
        }

        return await element.get_children();

    }


    async getParent (element: StringtableModel): Promise<StringtableModel | undefined> {
        return element.parent;
    }


    async resolveTreeItem (item: vscode.TreeItem, element: StringtableModel, token: vscode.CancellationToken): Promise<vscode.TreeItem | undefined> {
        if (element instanceof StringtableUsageLocationModel) {
            const found_key = element.usage_location as FoundKey;

            const location = new vscode.Location(vscode.Uri.file(found_key.file), found_key.range);
            if (location) {
                item.command = { command: "editor.action.goToLocations", arguments: [location.uri, location.range.start, [location], "goto", "No location"], title: "show" };
            }
        }


        return item;
    }

    private _onDidChangeTreeData: vscode.EventEmitter<StringtableModel | StringtableModel[] | undefined> = new vscode.EventEmitter<StringtableModel | StringtableModel[] | undefined>();

    readonly onDidChangeTreeData = this._onDidChangeTreeData.event;


    async load (): Promise<void> {
        console.log(`loading StringTableTreeView`);
        this.models = this.stringtables_data.all_stringtable_file_data_items.map((item) => { return new StringtableFileModel(item, this.filter_function); });
        await Promise.all(this.models.map((item) => { item.show_container = false; return item.load(); }));


        this._onDidChangeTreeData.fire(undefined);
    }

    async reload (): Promise<void> {
        this.models = [];
        this._onDidChangeTreeData.fire(undefined);
        await utils.sleep(1);
        await this.load();
    }

    async reload_entry (entry: StringtableEntry) {
        for (const file_model of this.models) {
            const container = file_model.get_container(entry.container_name, true);
            if (!container) { continue; }

            const model = container.entry_map.get(entry.key_name.toLowerCase());
            if (model) {
                this._onDidChangeTreeData.fire(model);
            }
        }
    }
    async filter_entries (filter_type: FilterType): Promise<void> {


        switch (filter_type) {

            case FilterType.ALL:
                this.filter_function = undefined;
                break;


            case FilterType.ONLY_NO_TRANSLATIONS:
                this.filter_function = (item) => {
                    if (item instanceof StringtableEntryModel) {
                        return (!item.entry.has_translations);
                    }
                    return true;
                };
                break;

            case FilterType.ONLY_PLACEHOLDER:
                this.filter_function = (item) => {
                    if (item instanceof StringtableEntryModel) {
                        return (item.entry.placeholder.length > 0);
                    }
                    return true;
                };
                break;

            case FilterType.ONLY_NO_USAGE:
                this.filter_function = (item) => {
                    if (item instanceof StringtableEntryModel) {
                        return (item.entry.usage_locations.length === 0);
                    }
                    return true;
                };
                break;
        };

        await this.reload();
    };

    get [Symbol.toStringTag] () {

        return `${this.constructor.name}()`;
    };

    async register (context: vscode.ExtensionContext) {

        context.subscriptions.push(vscode.window.registerTreeDataProvider("stringtableDataTree", this));
        context.subscriptions.push(vscode.commands.registerCommand("stringtableDataTree.refresh", (...args) => this.reload(), this));
        context.subscriptions.push(vscode.commands.registerCommand("stringtableDataTree.filterOnlyNoTranslations", (...args) => this.filter_entries(FilterType.ONLY_NO_TRANSLATIONS), this));
        context.subscriptions.push(vscode.commands.registerCommand("stringtableDataTree.unsetFilter", (...args) => this.filter_entries(FilterType.ALL), this));
        context.subscriptions.push(vscode.commands.registerCommand("stringtableDataTree.filterOnlyPlaceholder", (...args) => this.filter_entries(FilterType.ONLY_PLACEHOLDER), this));
        context.subscriptions.push(vscode.commands.registerCommand("stringtableDataTree.filterOnlyNoUsage", (...args) => this.filter_entries(FilterType.ONLY_NO_USAGE), this));



    }

}