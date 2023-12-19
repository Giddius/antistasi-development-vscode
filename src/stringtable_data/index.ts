
// region[Imports]

import * as vscode from 'vscode';




import * as path from "path";


import * as fs from "fs";

import * as utilities from "../utilities";

import { StringTableDataStorage } from "./storage";



// endregion[Imports]

class FoundKey {
    text: string;
    range: vscode.Range;


    constructor(text: string, line_number: number, start_index: number, end_index: number) {
        this.text = text;
        this.range = new vscode.Range(line_number, start_index, line_number, end_index);
    }
};

export class StringTableProvider implements vscode.Disposable, vscode.HoverProvider, vscode.DefinitionProvider {
    protected config: vscode.WorkspaceConfiguration;
    protected data: StringTableDataStorage;
    protected diagnostic_collection: vscode.DiagnosticCollection
    protected problems_handling_timeouts: Map<vscode.Uri, NodeJS.Timeout>



    constructor(config: vscode.WorkspaceConfiguration, stringtable_data: StringTableDataStorage) {
        this.config = config;
        this.data = stringtable_data;
        this.diagnostic_collection = vscode.languages.createDiagnosticCollection("antistasi-development");
        this.problems_handling_timeouts = new Map<vscode.Uri, NodeJS.Timeout>();

    };



    on_config_changed = (event: vscode.ConfigurationChangeEvent) => {
        const root_workspace_folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.at(0);

        if (!event.affectsConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder)) return;

        this.config = vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder);
        this.data.load_all()
        utilities.sleep(500).then(() => this.reload_problems());


    };

    on_text_document_saved = (document: vscode.TextDocument) => {
        if (
            (path.extname(document.fileName).toLowerCase() === ".sqf")
            || (path.extname(document.fileName).toLowerCase() === ".cpp")
            || (path.extname(document.fileName).toLowerCase() === ".hpp")
            || (path.extname(document.fileName).toLowerCase() === ".ext")
        ) {
            this.handle_problems(document.uri);
        };
        if (path.basename(document.fileName).toLowerCase() !== "stringtable.xml") return;

        this.data.load_data([document.uri])
        utilities.sleep(250).then(() => this.reload_problems());

    };


    on_text_document_closed = (document: vscode.TextDocument) => {

        this.diagnostic_collection.delete(document.uri);
    };

    on_text_document_open = (document: vscode.TextDocument) => {

        if (
            (path.extname(document.fileName).toLowerCase() === ".sqf")
            || (path.extname(document.fileName).toLowerCase() === ".cpp")
            || (path.extname(document.fileName).toLowerCase() === ".hpp")
            || (path.extname(document.fileName).toLowerCase() === ".ext")
        ) {
            this.handle_problems(document.uri);
        };
    };

    on_did_change_document = (event: vscode.TextDocumentChangeEvent) => {

        let timeout = this.problems_handling_timeouts.get(event.document.uri);

        if (timeout) {
            clearTimeout(timeout);
            this.problems_handling_timeouts.delete(event.document.uri);
        };

        timeout = setTimeout(() => { this.on_text_document_open(event.document); }, 2500);
        this.problems_handling_timeouts.set(event.document.uri, timeout);



    };
    private _check_hover_enabled(): boolean {

        const general_enabled = this.config.get("enable");
        const hover_enabled = this.config.get("enableHover");


        return ((general_enabled === true) && (hover_enabled === true));
    };


    private _check_definition_enabled(): boolean {

        const general_enabled = this.config.get("enable");
        const definition_enabled = this.config.get("enableDefinition");
        return ((general_enabled === true) && (definition_enabled === true));

    };

    private _check_problems_handling_enabled(): boolean {
        const general_enabled = this.config.get("enable");
        const problems_enabled = this.config.get("enableUndefinedKeysProblems");
        return ((general_enabled === true) && (problems_enabled === true));

    };

    async get_word(document: vscode.TextDocument, range: vscode.Range): Promise<string> {


        let curr_word = document.getText(range).toLowerCase();




        return curr_word
    };

    async provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> {

        if (token.isCancellationRequested) return;



        if (!this._check_hover_enabled()) return;

        const word_range = document.getWordRangeAtPosition(position)

        if (!word_range) return;

        let curr_word = await this.get_word(document, word_range);

        if (!curr_word.startsWith("str_")) return;

        const data = await this.data.get_entry(curr_word, document.uri.fsPath)

        if (!data) return;

        return new vscode.Hover(data.get_hover_text(), word_range);

    }

    async provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {

        if (token.isCancellationRequested) return;

        if (!this._check_definition_enabled()) return;

        const word_range = document.getWordRangeAtPosition(position)

        if (!word_range) return;

        let curr_word = await this.get_word(document, word_range);

        if (!curr_word.startsWith("str_")) return;

        const data = await this.data.get_entry(curr_word, document.uri.fsPath)

        if (!data) return;

        return data.get_location();
    }





    async handle_problems(file: vscode.Uri): Promise<void> {

        this.diagnostic_collection.delete(file);

        if (!this._check_problems_handling_enabled()) return;

        async function get_all_matches(in_line: string, in_line_number: number): Promise<FoundKey[]> {
            const regex = /((?<=\")STR_[\w\d\_\-]+(?=\"))|((?<=\$)STR_[\w\d\_\-]+)/gmi

            let m;
            const found_result = new Array<FoundKey>();


            while ((m = regex.exec(in_line)) !== null) {
                if (m.index === regex.lastIndex) {
                    regex.lastIndex++;
                }


                found_result.push(new FoundKey(m[0], in_line_number, m.index, regex.lastIndex))

            }
            regex.lastIndex = 0;
            return found_result;
        };
        const text = (await vscode.workspace.fs.readFile(file)).toString();
        const diagnostic_items = new Array<vscode.Diagnostic>()
        let line_number = 0;
        for (let line of text.split(/\r?\n/gm)) {

            for (let found_key of await get_all_matches(line, line_number)) {
                if (!await this.data.get_entry(found_key.text, file.fsPath)) {
                    diagnostic_items.push(new vscode.Diagnostic(found_key.range, found_key.text + " is not defined"))
                    console.log(`adding ${found_key.text}`)
                }
            };
            line_number++;



        };
        this.diagnostic_collection.set(file, diagnostic_items);
    };

    async reload_problems() {
        const uris = []

        for (let tab_group of vscode.window.tabGroups.all) {
            for (let tab of tab_group.tabs) {
                if (!(tab.input instanceof vscode.TabInputText)) continue;

                let uri = tab.input.uri;
                if ((path.extname(uri.fsPath) !== ".sqf")
                    && (path.extname(uri.fsPath) !== ".ext")
                    && (path.extname(uri.fsPath) !== ".cpp")
                    && (path.extname(uri.fsPath) !== ".hpp")) continue;

                uris.push(uri);
            };
        };
        await Promise.all(uris.map((_uri) => { this.handle_problems(_uri) }))

    };

    static get hover_selectors(): ReadonlyArray<vscode.DocumentFilter> {
        const selectors = new Array<vscode.DocumentFilter>();


        selectors.push({ scheme: "file", pattern: "**/*.sq[fm]" });
        selectors.push({ scheme: "file", pattern: "**/*.ext" });
        selectors.push({ scheme: "file", pattern: "**/*.[ch]pp" });






        const out: ReadonlyArray<vscode.DocumentFilter> = Array.from(selectors);

        return out;
    };



    dispose() {

        this.data.clear();
    };





};





export async function activate_sub_extension(context: vscode.ExtensionContext): Promise<void> {


    const root_workspace_folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.at(0);

    const config = vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder);



    const stringtable_data: StringTableDataStorage = new StringTableDataStorage();
    let STRINGTABLE_PROVIDER: StringTableProvider = new StringTableProvider(config, stringtable_data);

    await stringtable_data.load_all();






    context.subscriptions.push(vscode.languages.registerHoverProvider(StringTableProvider.hover_selectors, STRINGTABLE_PROVIDER));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(StringTableProvider.hover_selectors, STRINGTABLE_PROVIDER));

    context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(STRINGTABLE_PROVIDER.on_config_changed));
    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(STRINGTABLE_PROVIDER.on_text_document_saved));

    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(STRINGTABLE_PROVIDER.on_text_document_open));
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(STRINGTABLE_PROVIDER.on_did_change_document));

    context.subscriptions.push(vscode.workspace.onDidCloseTextDocument(STRINGTABLE_PROVIDER.on_text_document_closed));




    const git_watcher = vscode.workspace.createFileSystemWatcher("**/.git/HEAD");

    git_watcher.onDidChange((uri) => {

        stringtable_data.load_all();
    })

    context.subscriptions.push(git_watcher);


    const uris = []

    for (let tab_group of vscode.window.tabGroups.all) {
        for (let tab of tab_group.tabs) {
            if (!(tab.input instanceof vscode.TabInputText)) continue;

            let uri = tab.input.uri;
            if ((path.extname(uri.fsPath) !== ".sqf")
                && (path.extname(uri.fsPath) !== ".ext")
                && (path.extname(uri.fsPath) !== ".cpp")
                && (path.extname(uri.fsPath) !== ".hpp")) continue;

            uris.push(uri);
        };
    };
    await Promise.all(uris.map((_uri) => { STRINGTABLE_PROVIDER.handle_problems(_uri) }))

};



export async function deactivate_sub_extension() { };