
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";
import * as utilities from "../utilities";
import { StringTableDataStorage } from "./storage";
import { promises } from "dns";

// endregion[Imports]

class FoundKey {
    text: string;
    range: vscode.Range;


    constructor (text: string, line_number: number, start_index: number, end_index: number) {
        this.text = text;
        this.range = new vscode.Range(line_number, start_index, line_number, end_index);
    };
};


export class StringTableProvider implements vscode.HoverProvider, vscode.DefinitionProvider {


    public static basic_allowed_file_name_extensions: string[] = [
        ".sqf",
        ".cpp",
        ".hpp",
        ".ext",
        ".inc"
    ];


    protected config: vscode.WorkspaceConfiguration;
    protected data: StringTableDataStorage;
    protected diagnostic_collection: vscode.DiagnosticCollection;
    protected problems_handling_timeouts: Map<vscode.Uri, NodeJS.Timeout>;



    constructor (stringtable_data: StringTableDataStorage) {
        this.config = this.get_config();
        this.data = stringtable_data;
        this.diagnostic_collection = vscode.languages.createDiagnosticCollection("antistasi-development");
        this.problems_handling_timeouts = new Map<vscode.Uri, NodeJS.Timeout>();

    };

    private get_extra_allowed_file_name_extensions (): string[] {
        return this.config.get("extraFileNameExtensions") as string[];
    };

    public get file_selectors (): vscode.DocumentSelector {

        return this.allowed_file_name_extensions.map((value) => { return { scheme: "file", pattern: "**/*" + value }; }) as vscode.DocumentSelector;

    }



    public get allowed_file_name_extensions (): string[] {

        return Array.from(StringTableProvider.basic_allowed_file_name_extensions).concat(this.get_extra_allowed_file_name_extensions());



    }


    private get_config (): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data", null);
    };

    on_config_changed = (event: vscode.ConfigurationChangeEvent) => {

        this.config = this.get_config();
        this.data.load_all();
        utilities.sleep(500).then(() => this.reload_problems());


    };

    on_text_document_saved = (document: vscode.TextDocument) => {
        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            this.handle_problems(document);
        } else if (path.basename(document.fileName).toLowerCase() === "stringtable.xml") {

            this.data.load_data([document.uri]);
            utilities.sleep(250).then(() => this.reload_problems());
        };

    };


    on_text_document_closed = (document: vscode.TextDocument) => {
        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            let timeout = this.problems_handling_timeouts.get(document.uri);
            if (timeout) {
                clearTimeout(timeout);
                this.problems_handling_timeouts.delete(document.uri);
            };
            this.diagnostic_collection.delete(document.uri);
        };
    };

    on_text_document_open = (document: vscode.TextDocument) => {

        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            this.handle_problems(document);
        };
    };

    on_did_change_document = (event: vscode.TextDocumentChangeEvent) => {
        if (this.allowed_file_name_extensions.includes(path.extname(event.document.fileName).toLowerCase())) {
            let timeout = this.problems_handling_timeouts.get(event.document.uri);

            if (timeout) {
                clearTimeout(timeout);
                this.problems_handling_timeouts.delete(event.document.uri);
            };

            timeout = setTimeout(() => { this.on_text_document_open(event.document); }, 1000);
            this.problems_handling_timeouts.set(event.document.uri, timeout);



        };
    };

    private _check_hover_enabled (): boolean {

        const general_enabled = this.config.get("enable");
        const hover_enabled = this.config.get("enableHover");


        return ((general_enabled === true) && (hover_enabled === true));
    };


    private _check_definition_enabled (): boolean {

        const general_enabled = this.config.get("enable");
        const definition_enabled = this.config.get("enableDefinition");
        return ((general_enabled === true) && (definition_enabled === true));

    };

    private _check_problems_handling_enabled (): boolean {
        const general_enabled = this.config.get("enable") as boolean;
        const problems_enabled = this.config.get("enableUndefinedKeysProblems") as boolean;
        return ((general_enabled === true) && (problems_enabled === true));

    };


    private _get_stringtable_keys_to_ignore (): string[] {
        const raw_keys = this.config.get("undefinedKeysToIgnore") as string[];
        if (!raw_keys) return [];

        return raw_keys.map((value) => value.toLowerCase());


    };

    async get_word (document: vscode.TextDocument, range: vscode.Range): Promise<string> {


        let curr_word = document.getText(range).toLowerCase();




        return curr_word;
    };


    async provideHover (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> {

        if (token.isCancellationRequested) return;


        if (!this._check_hover_enabled()) return;



        const word_range = document.getWordRangeAtPosition(position);

        if (!word_range) return;

        let curr_word = await this.get_word(document, word_range);

        if (!curr_word.startsWith("str_")) return;

        const data = await this.data.get_entry(curr_word, document.uri.fsPath);

        if (!data) return;

        return new vscode.Hover(data.get_hover_text(), word_range);

    }

    async provideDefinition (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {

        if (token.isCancellationRequested) return;

        if (!this._check_definition_enabled()) return;

        const word_range = document.getWordRangeAtPosition(position);

        if (!word_range) return;

        let curr_word = await this.get_word(document, word_range);

        if (!curr_word.startsWith("str_")) return;

        const data = await this.data.get_entry(curr_word, document.uri.fsPath);

        if (!data) return;

        return data.get_location();
    }





    async handle_problems (file_or_document: vscode.Uri | vscode.TextDocument): Promise<void> {



        let file: vscode.Uri | undefined;

        if (!(file_or_document instanceof vscode.Uri)) {
            file = file_or_document.uri;
        } else {
            file = file_or_document;
        };
        await this.data.wait_on_is_loading();
        this.diagnostic_collection.delete(file);

        if (!this._check_problems_handling_enabled()) return;



        async function get_all_matches (in_line: string, in_line_number: number): Promise<FoundKey[]> {
            const regex = /((?<=\")STR_[\w\d\_\-]+(?=\"))|((?<=\$)STR_[\w\d\_\-]+)/gmi;

            let m;
            const found_result = new Array<FoundKey>();


            while ((m = regex.exec(in_line)) !== null) {
                if (m.index === regex.lastIndex) {
                    regex.lastIndex++;
                }


                found_result.push(new FoundKey(m[0], in_line_number, m.index, regex.lastIndex));

            }
            regex.lastIndex = 0;
            return found_result;
        };

        let inside_comment: boolean = false;

        const keys_to_ignore = this._get_stringtable_keys_to_ignore();
        let text: string | undefined;
        if (!(file_or_document instanceof vscode.Uri)) {
            text = file_or_document.getText();
        } else {
            text = (await vscode.workspace.fs.readFile(file)).toString();
        };

        const diagnostic_items = new Array<vscode.Diagnostic>();
        let line_number = 0;
        for (let line of text.split(/\r?\n/gm)) {
            if (line.trimStart().startsWith("//")) { line_number++; continue; };

            if (line.trimStart().startsWith("/*")) {
                inside_comment = true;
            };

            if ((line.trimStart().startsWith("*/"))) {
                inside_comment = false;
            };


            if (inside_comment === true) { line_number++; continue; };
            for (let found_key of await get_all_matches(line, line_number)) {
                if ((!await this.data.get_entry(found_key.text, file.fsPath)) && (!keys_to_ignore.includes(found_key.text.toLowerCase()))) {
                    diagnostic_items.push(new vscode.Diagnostic(found_key.range, found_key.text + " is not defined"));
                }
            };
            if ((line.trimEnd().endsWith("*/"))) {
                inside_comment = false;
            };
            line_number++;



        };
        this.diagnostic_collection.set(file, diagnostic_items);
    };

    async reload_problems () {
        const uris = [];

        for (let tab_group of vscode.window.tabGroups.all) {
            for (let tab of tab_group.tabs) {
                if (!(tab.input instanceof vscode.TabInputText)) continue;

                let uri = tab.input.uri;
                if (!this.allowed_file_name_extensions.includes(path.extname(uri.fsPath).toLowerCase())) continue;

                uris.push(uri);
            };
        };
        await Promise.all(uris.map((_uri) => { this.handle_problems(_uri); }));

    };




    public async clear (): Promise<void> {
        this.diagnostic_collection.clear();
        this.problems_handling_timeouts = new Map();
        await this.data.clear();
    };



    public async register (): Promise<vscode.Disposable[]> {
        const disposables: vscode.Disposable[] = [];


        disposables.push(vscode.languages.registerDefinitionProvider(this.file_selectors, this));
        disposables.push(vscode.languages.registerHoverProvider(this.file_selectors, this));

        disposables.push(vscode.workspace.onDidChangeConfiguration(this.on_config_changed));

        disposables.push(vscode.workspace.onDidSaveTextDocument(this.on_text_document_saved));
        disposables.push(vscode.workspace.onDidOpenTextDocument(this.on_text_document_open));
        disposables.push(vscode.workspace.onDidChangeTextDocument(this.on_did_change_document));

        disposables.push(vscode.workspace.onDidCloseTextDocument(this.on_text_document_closed));

        utilities.sleep(750).then(() => this.reload_problems());


        return disposables;
    };


    get [Symbol.toStringTag] () {

        return this.constructor.name;
    };

};