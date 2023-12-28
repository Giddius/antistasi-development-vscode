
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";
import * as utilities from "../utilities";
import { StringTableDataStorage } from "./storage";
import { parse_xml_file_async, get_location, add_to_stringtable_file } from "./parsing";
import { type } from "os";
import { randomInt } from "crypto";
import { match } from "assert";



// endregion[Imports]

class FoundKey {
    text: string;
    range: vscode.Range;


    constructor (text: string, line_number: number, start_index: number, end_index: number) {
        this.text = text;
        this.range = new vscode.Range(line_number, start_index, line_number, end_index);
    };
};


export class StringTableProvider implements vscode.HoverProvider, vscode.DefinitionProvider, vscode.CodeActionProvider, vscode.CodeActionProviderMetadata {


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
    readonly providedCodeActionKinds: vscode.CodeActionKind[] = [vscode.CodeActionKind.QuickFix];


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
        return vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data");
    };

    on_config_changed = async (event: vscode.ConfigurationChangeEvent) => {
        if (!event.affectsConfiguration("antistasiDevelopment.stringtable_data")) return;
        this.config = this.get_config();

        await utilities.sleep(500).then(() => this.reload_problems());


    };

    on_text_document_saved = async (document: vscode.TextDocument) => {

        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            await this.handle_problems(document);
        };

    };


    on_text_document_closed = async (document: vscode.TextDocument) => {
        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            let timeout = this.problems_handling_timeouts.get(document.uri);
            if (timeout) {
                clearTimeout(timeout);
                this.problems_handling_timeouts.delete(document.uri);
            };
            this.diagnostic_collection.delete(document.uri);
        };
    };

    on_text_document_open = async (document: vscode.TextDocument) => {

        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            await this.handle_problems(document);
        };
    };

    on_did_change_document = async (event: vscode.TextDocumentChangeEvent) => {

        if (this.allowed_file_name_extensions.includes(path.extname(event.document.fileName).toLowerCase())) {
            let timeout = this.problems_handling_timeouts.get(event.document.uri);

            if (timeout) {
                clearTimeout(timeout);
                this.problems_handling_timeouts.delete(event.document.uri);
            };

            timeout = setTimeout(async () => { this.on_text_document_open(event.document); }, (1 * 1000));
            this.problems_handling_timeouts.set(event.document.uri, timeout);



        };
    };


    on_data_reloaded = async (data: StringTableDataStorage) => {
        await this.reload_problems();

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


    async provideCodeActions (document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<(vscode.CodeAction | vscode.Command)[]> {
        if ((!context.diagnostics) || (context.diagnostics.length <= 0) || (context.triggerKind !== 1)) return [];
        let action = new vscode.CodeAction("create new", vscode.CodeActionKind.QuickFix);
        let key_name = await this.get_word(document, range);
        action.command = { title: "insert new key", command: 'antistasi.insert-stringtable-key', arguments: [document.uri, key_name] };
        action.diagnostics = Array.from(context.diagnostics);

        return [action];
    }




    async handle_problems (file_or_document: vscode.Uri | vscode.TextDocument): Promise<void> {




        let file: vscode.Uri | undefined;

        if (!(file_or_document instanceof vscode.Uri)) {
            file = file_or_document.uri;
        } else {
            file = file_or_document;
        };

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
            if (!text) {
                text = (await vscode.workspace.fs.readFile(file)).toString();
            }
        } else {
            text = (await vscode.workspace.fs.readFile(file)).toString();
        };


        const diagnostic_items = new Array<vscode.Diagnostic>();
        let line_number = 0;
        for (let line of text.split(/\r?\n/gm)) {
            await utilities.sleep(10);
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
                    let data_item = await this.data.get_data_item_for_file(file);
                    let text = `'${found_key.text}' undefined`;
                    if ((data_item) && (data_item.is_parseable === false)) {
                        text = text + `\n('${vscode.workspace.asRelativePath(data_item.file_path)}' is not parseable)`;
                    };
                    let diagnostic_item = new vscode.Diagnostic(found_key.range, text, vscode.DiagnosticSeverity.Warning);
                    diagnostic_item.source = "antistasi-development";
                    if (data_item) {
                        diagnostic_item.code = { value: `Stringtable(${data_item.name})`, target: data_item.uri };
                    };
                    diagnostic_items.push(diagnostic_item);
                }
            };
            if ((line.trimEnd().endsWith("*/"))) {
                inside_comment = false;
            };
            line_number++;



        };

        this.diagnostic_collection.set(file, diagnostic_items);


        let timeout = this.problems_handling_timeouts.get(file);

        if (timeout) {
            clearTimeout(timeout);
            this.problems_handling_timeouts.delete(file);
        };

        timeout = setTimeout(async () => { this.handle_problems(file_or_document); }, (10 * 1000) + randomInt(0, 500));
        this.problems_handling_timeouts.set(file, timeout);

    };

    async reload_problems () {

        const tasks: Promise<void>[] = [];

        await utilities.sleep(100);

        const open_documents = vscode.workspace.textDocuments;







        const open_file_paths_map = new Map(open_documents.map((value) => [path.normalize(value.uri.fsPath), value]));
        for (let tab_group of vscode.window.tabGroups.all) {
            for (let tab of tab_group.tabs) {
                if (!(tab.input instanceof vscode.TabInputText)) continue;
                let uri = tab.input.uri;


                if (!this.allowed_file_name_extensions.includes(path.extname(uri.fsPath).toLowerCase())) continue;
                let existing_document = open_file_paths_map.get(path.normalize(uri.fsPath));

                if (!existing_document) {

                    let maybe_existing_document = await vscode.workspace.openTextDocument(uri);
                    existing_document = maybe_existing_document;
                }
                tasks.push(this.handle_problems(existing_document));

                await utilities.sleep(10);
            };
        };

        await Promise.all(tasks);

    };




    public async clear (): Promise<void> {
        this.diagnostic_collection.clear();
        for (let timeout of this.problems_handling_timeouts.values()) {
            clearTimeout(timeout);
        };
        this.problems_handling_timeouts.clear();
        await this.data.clear();
    };

    insert_new_stringtable_key = async (file?: vscode.Uri, key_name?: string, container_name?: string, original_value?: string, token?: vscode.CancellationToken) => {


        if (!file) {
            let file_name = await vscode.window.showQuickPick(this.data.all_stringtable_names, { title: "Stringtable file", canPickMany: false, ignoreFocusOut: true }, token);
            if ((!file_name) || (token?.isCancellationRequested)) return;
            file = (await this.data.get_data_item_for_name(file_name))?.uri;
        };

        if (!file) return;
        const data_item = await this.data.get_data_item_for_file(file);

        if (!data_item) return;

        if (!container_name) {
            container_name = await vscode.window.showQuickPick(["New container name"].concat(Array.from(data_item.all_container_names)), { title: "Container Name", canPickMany: false, ignoreFocusOut: true }, token);

            if (container_name === "New container name") {
                container_name = await vscode.window.showInputBox({
                    title: "New container name",
                    ignoreFocusOut: true,
                    validateInput: (value) => {
                        if (value.length <= 0) {
                            return "Empty name not allowed!";
                        };

                        if (data_item.all_container_names.map((v) => v.toLowerCase()).includes(value.toLowerCase())) {
                            return "Container name is already defined";
                        };

                    }
                }, token);
            };

            if ((token?.isCancellationRequested) || (!container_name)) return;
            container_name = container_name.trim();
        };

        if (!key_name) {
            key_name = await vscode.window.showInputBox({
                title: "Key Name",
                value: "STR_",
                valueSelection: [100, 100],
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (value.length <= 0) {
                        return "Empty name not allowed!";
                    };
                    if (!value.toLowerCase().startsWith("str_")) {
                        return "Key names need to start with 'STR_'!";
                    };
                    if (data_item.has_entry(value)) {
                        return "Name already in defined!";
                    };
                }
            }, token);
            if ((token?.isCancellationRequested) || (!key_name)) return;

            key_name = key_name.replace(/^str_/m, "STR_").trim();
        };


        if (!original_value) {
            original_value = await vscode.window.showInputBox({
                title: "English Text",
                ignoreFocusOut: true,
                validateInput: (value) => {
                    if (value.length <= 0) {
                        return "Empty name not allowed!";
                    };

                }
            }, token);
            if (token?.isCancellationRequested) return;

        };


        if ((!container_name) || (!key_name) || (!original_value) || (!file) || (token?.isCancellationRequested)) return;

        await add_to_stringtable_file(data_item.uri, container_name, key_name, original_value);
        await this.data.load_data([data_item.uri]);
        await this.handle_problems(file);

        return key_name;

    };


    convert_to_stringtable_key = async () => {

        const editor = vscode.window.activeTextEditor;

        if (!editor) return;

        let selection: vscode.Range | vscode.Selection = editor.selection;



        if (selection.isEmpty) {
            let line = editor.document.lineAt(selection.start.line);
            if (line.isEmptyOrWhitespace) return;
            if ((!line.text.includes('"')) && (!line.text.includes("'"))) return;



            let regex = /((?<quotes>["']).*?\k<quotes>)/gm;
            let m;
            let found = [];
            while ((m = regex.exec(line.text)) !== null) {
                // This is necessary to avoid infinite loops with zero-width matches
                if (m.index === regex.lastIndex) {
                    regex.lastIndex++;
                }

                // The result can be accessed through the `m`-variable.
                found.push([m.index, regex.lastIndex]);
            };
            if (found.length <= 0) return;
            for (let indexes of found) {
                if ((indexes[0] <= selection.start.character) && (indexes[1] >= selection.end.character)) {
                    selection = new vscode.Selection(selection.start.line, indexes[0], selection.end.line, indexes[1]);
                    break;
                }
            }
            // let _temp_text = editor.document.getText(selection);

            // if (_temp_text.startsWith('"') || _temp_text.endsWith('"') || _temp_text.startsWith("'") || _temp_text.endsWith("'")) break;

            if (selection.start.character < 0) return;





        };

        const raw_text = editor.document.getText(selection);

        // console.log(`raw_text: %s`, raw_text);

        if ((!raw_text.startsWith('"'))
            && (!raw_text.endsWith('"'))
            && (!raw_text.startsWith("'"))
            && (!raw_text.endsWith("'"))) return;

        const text = utilities.resolve_sqf_string(raw_text);
        // console.log(`text: ${text}`);
        const key_name = await this.insert_new_stringtable_key(editor.document.uri, undefined, undefined, text);

        if (!key_name) return;

        editor.edit((editBuilder) => {
            switch (path.extname(editor.document.uri.fsPath).toLowerCase()) {
                case ".sqf":
                    editBuilder.replace(selection, `localize "${key_name}"`);
                    break;

                default:
                    editBuilder.replace(selection, `$${key_name}`);
                    break;


            };

        });





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
        disposables.push(vscode.commands.registerCommand('antistasi.insert-stringtable-key', this.insert_new_stringtable_key));
        disposables.push(vscode.commands.registerCommand('antistasi.convert-to-stringtable-key', this.convert_to_stringtable_key));

        disposables.push(vscode.languages.registerCodeActionsProvider(this.file_selectors, this));

        return disposables;
    };


    get [Symbol.toStringTag] () {

        return this.constructor.name;
    };

};