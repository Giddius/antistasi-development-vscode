
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";
import * as utils from "#utilities";
import { StringTableDataStorage } from "./storage";
import { randomInt, randomUUID } from "crypto";

import * as glob from "glob";
import { StringtableDataLoadedEvent } from "typings/general";


import { create_undefined_stringtable_keys_result_web_view } from "../../web_views/undefined_stringtable_keys_view";

// endregion[Imports]

export class FoundKey {
    text: string;
    range: vscode.Range;
    file: string;
    specific_id: string;




    constructor (text: string, line_number: number, start_index: number, end_index: number, file: string) {
        this.text = text;
        this.range = new vscode.Range(line_number, start_index, line_number, end_index);
        this.file = path.resolve(file);
        this.specific_id = randomUUID().toString();
    };

    public get relative_path (): string {
        return vscode.workspace.asRelativePath(this.file);
    };

    public get json_data () {
        return {
            name: this.text,
            file: this.file,
            relative_path: this.relative_path,
            start_line: this.range.start.line,
            start_char: this.range.start.character,
            end_line: this.range.end.line,
            end_char: this.range.end.character
        };
    };


    public get json_string_data (): string {
        return JSON.stringify(this.json_data);
    };





};


export class StringTableProvider implements vscode.HoverProvider, vscode.DefinitionProvider, vscode.CodeActionProvider, vscode.CodeActionProviderMetadata, vscode.CompletionItemProvider {

    public readonly config_key: string = "antistasiDevelopment.stringtable_data";

    public static basic_allowed_file_name_extensions: string[] = [
        ".sqf",
        ".sqm",
        ".cpp",
        ".hpp",
        ".ext",
        ".inc"
    ];


    protected config: vscode.WorkspaceConfiguration;
    protected data: StringTableDataStorage;
    protected diagnostic_collection: vscode.DiagnosticCollection;
    protected problems_handling_timeouts: Map<vscode.Uri, NodeJS.Timeout>;
    protected current_completion_list: vscode.CompletionList | undefined;
    readonly providedCodeActionKinds: vscode.CodeActionKind[] = [vscode.CodeActionKind.QuickFix];


    constructor (stringtable_data: StringTableDataStorage) {
        this.config = this.load_config();
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


    private load_config (): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(this.config_key);
    };

    handle_on_config_changed = async (event: vscode.ConfigurationChangeEvent) => {
        if (!event.affectsConfiguration(this.config_key)) { return; }
        this.config = this.load_config();

        await utils.sleep(500).then(() => this.reload_problems());


    };

    handle_on_text_document_saved = async (document: vscode.TextDocument) => {

        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            await this.handle_problems(document.uri);
        };

    };


    handle_on_text_document_closed = async (document: vscode.TextDocument) => {
        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            let timeout = this.problems_handling_timeouts.get(document.uri);
            if (timeout) {
                clearTimeout(timeout);
                this.problems_handling_timeouts.delete(document.uri);
            };
            this.diagnostic_collection.delete(document.uri);
        };
    };

    handle_on_text_document_open = async (document: vscode.TextDocument) => {

        if (this.allowed_file_name_extensions.includes(path.extname(document.fileName).toLowerCase())) {
            await this.handle_problems(document.uri);
        };

    };

    handle_on_did_change_document = async (event: vscode.TextDocumentChangeEvent) => {

        if (this.allowed_file_name_extensions.includes(path.extname(event.document.fileName).toLowerCase())) {
            let timeout = this.problems_handling_timeouts.get(event.document.uri);

            if (timeout) {
                clearTimeout(timeout);
                this.problems_handling_timeouts.delete(event.document.uri);
            };

            timeout = setTimeout(async () => { this.handle_on_text_document_open(event.document); }, (1 * 1000));
            this.problems_handling_timeouts.set(event.document.uri, timeout);



        };
    };


    handle_on_data_reloaded = async (event: StringtableDataLoadedEvent) => {
        const tasks = [];
        const open_file_paths: ReadonlyArray<string> = vscode.workspace.textDocuments.map((item) => path.normalize(item.uri.fsPath));
        for (const item of event.changed_files) {
            let parent_folder = vscode.workspace.asRelativePath(item.uri.fsPath.split(path.sep).slice(0, -1).join(path.sep), false);
            let pattern = `${parent_folder}${path.sep}**${path.sep}*{${this.allowed_file_name_extensions.map((item) => item.replace(/^./, "")).join(',')}}`.replace(/\\/gm, "/");

            let files = await vscode.workspace.findFiles(pattern);

            for (let file of files) {
                if ((this.diagnostic_collection.has(file)) || ((open_file_paths.includes(path.normalize(file.fsPath))))) {
                    tasks.push(this.handle_problems(file));
                    await utils.sleep(25);
                } else {
                    this.diagnostic_collection.delete(file);
                }

            };
        };
        await Promise.all(tasks);
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
        if (!raw_keys) { return []; }

        return raw_keys.map((value) => value.toLowerCase());


    };

    async get_word (document: vscode.TextDocument, range: vscode.Range): Promise<string> {

        let curr_word = document.getText(range).toLowerCase().replace(/^"/gm, "").replace(/"$/gm, "").replace(/^\$/gm, "");

        return curr_word;
    };


    async provideHover (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Hover | undefined> {

        if (token.isCancellationRequested) { return; }


        if (!this._check_hover_enabled()) { return; }



        const word_range = document.getWordRangeAtPosition(position);

        if (!word_range) { return; }

        let curr_word = await this.get_word(document, word_range);

        if (!curr_word.startsWith("str_")) { return; }

        const data = await this.data.get_entry(curr_word, document.uri.fsPath);

        if (!data) { return; }

        return new vscode.Hover(data.get_hover_text(), word_range);

    }

    async provideDefinition (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {

        if (token.isCancellationRequested) { return; }

        if (!this._check_definition_enabled()) { return; }

        const word_range = document.getWordRangeAtPosition(position);

        if (!word_range) { return; }

        let curr_word = await this.get_word(document, word_range);

        if (!curr_word.startsWith("str_")) { return; }

        const data = await this.data.get_entry(curr_word, document.uri.fsPath);

        if (!data) { return; }

        return data.get_location();
    }


    async provideCodeActions (document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): Promise<(vscode.CodeAction | vscode.Command)[]> {
        if ((!context.diagnostics) || (context.diagnostics.length <= 0) || (context.triggerKind !== 1)) { return []; }
        let action = new vscode.CodeAction("create new", vscode.CodeActionKind.QuickFix);
        let key_name = await this.get_word(document, range);
        action.command = { title: "insert new key", command: 'antistasi.insert-stringtable-key', arguments: [{ in_file: document.uri, key_name: key_name }] };
        action.diagnostics = Array.from(context.diagnostics);

        return [action];
    }



    async provideCompletionItems (document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): Promise<vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>> {

        if (this.current_completion_list === undefined) {
            this.current_completion_list = new vscode.CompletionList([], true);
        };


        if (context.triggerKind === vscode.CompletionTriggerKind.Invoke) {


            this.current_completion_list = new vscode.CompletionList([], true);
        };

        if (token.isCancellationRequested) { return this.current_completion_list; }

        this.current_completion_list.items = [];

        const word_range = document.getWordRangeAtPosition(position);

        if (!word_range) { return this.current_completion_list; };

        const current_word = await this.get_word(document, word_range);

        if (!current_word.toLowerCase().startsWith("str_")) { return this.current_completion_list; };


        const possible_keys = await this.data.get_possible_entries(current_word);

        for (const possible_key of possible_keys) {
            let completion_item = new vscode.CompletionItem(possible_key, vscode.CompletionItemKind.Constant);
            completion_item.filterText = possible_key.toLowerCase();
            completion_item.sortText = possible_key.replace(/^str_/gmi, "").replace(/_/gmi, "").toLowerCase();

            this.current_completion_list.items.push(completion_item);
        };


        return this.current_completion_list;

    };

    async handle_problems (file: vscode.Uri, recurring: boolean = true): Promise<FoundKey[] | undefined> {




        if ((!this._check_problems_handling_enabled())) {
            this.diagnostic_collection.delete(file);
            return;
        };


        async function* get_all_matches (in_line: string, in_line_number: number) {


            function clean_text (in_text: string): string {
                return in_text.trim().replace(/(^"?\$?)(.*?)("?$)/g, `$2`);
            };



            // const regex = ([".hpp", ".cpp", ".ext", ".inc"].includes(path.extname(file!.fsPath))) ? cfg_regex : sqf_regex;
            const regex = /"?\$?STR_[\w\d\_\-]+"? *\+?/gid;

            for (const match of in_line.matchAll(regex)) {
                if (match[0].endsWith("+")) { continue; };
                yield new FoundKey(clean_text(match[0]), in_line_number, match.indices![0][0], match.indices![0][1], file.fsPath);
                await utils.sleep(0);
            };


        };

        let inside_comment: boolean = false;


        const keys_to_ignore = this._get_stringtable_keys_to_ignore();



        await new Promise<void>(r => setTimeout(r, 1));


        const diagnostic_items = new Array<vscode.Diagnostic>();

        const all_undefined_keys: FoundKey[] = [];

        for await (const [line_number, line] of utils.enumerate(utils.iter_file_lines(file.fsPath))) {
            if (!line) { continue; };
            const trimmed_line = line.trim();
            if ((trimmed_line.length <= 1) || (trimmed_line === "};") || (trimmed_line.startsWith("//"))) { continue; };
            if (trimmed_line.startsWith("/*")) {
                inside_comment = true;
            } else if ((trimmed_line.startsWith("*/"))) {
                inside_comment = false;
            };

            if (inside_comment === true) {
                if (trimmed_line.endsWith("*/")) {
                    inside_comment = false;
                };
                continue;
            }

            for await (const found_key of get_all_matches(line, line_number)) {
                if (found_key.text.endsWith("_")) { continue; }

                if (([".hpp", ".cpp", ".ext", ".inc"].includes(path.extname(file.fsPath))) && (found_key.text.startsWith("str_"))) {
                    const not_upper_case_diagnostic_item = new vscode.Diagnostic(found_key.range, "stringtable keys in '.hpp', '.cpp', '.ext' or '.inc' files, need to start with upper case 'STR_' ", vscode.DiagnosticSeverity.Error);
                    not_upper_case_diagnostic_item.source = "antistasi-development";
                    diagnostic_items.push(not_upper_case_diagnostic_item);
                };

                if ((!keys_to_ignore.includes(found_key.text.toLowerCase())) && (!await this.data.get_entry(found_key.text, file.fsPath))) {
                    const data_item = await this.data.get_data_item_for_file(file);
                    const message_text = `'${found_key.text}' undefined` + ((data_item?.is_parseable === false) ? `\n('${vscode.workspace.asRelativePath(data_item.file_path)}' is not parseable)` : "");

                    const diagnostic_item = new vscode.Diagnostic(found_key.range, message_text, vscode.DiagnosticSeverity.Warning);
                    diagnostic_item.source = "antistasi-development";
                    if (data_item) {
                        diagnostic_item.code = { value: `Stringtable(${data_item.name})`, target: data_item.uri };
                    };
                    diagnostic_items.push(diagnostic_item);
                    all_undefined_keys.push(found_key);
                }
                await utils.sleep(0);
            };




        };

        this.diagnostic_collection.set(file, diagnostic_items);

        if (recurring) {
            let timeout = this.problems_handling_timeouts.get(file);

            if (timeout) {
                clearTimeout(timeout);
                this.problems_handling_timeouts.delete(file);
            };

            timeout = setTimeout(async () => { this.handle_problems(file); }, (30 * 1000) + randomInt(0, 500));
            this.problems_handling_timeouts.set(file, timeout);

        };
        await utils.sleep(25);
        return all_undefined_keys;

    };

    async reload_problems () {

        const tasks: Promise<void | FoundKey[]>[] = [];

        await utils.sleep(100);

        const open_documents = vscode.workspace.textDocuments;







        const open_file_paths_map = new Map(open_documents.map((value) => [path.normalize(value.uri.fsPath), value]));
        for (let tab_group of vscode.window.tabGroups.all) {
            for (let tab of tab_group.tabs) {
                if (!(tab.input instanceof vscode.TabInputText)) { continue; }
                let uri = tab.input.uri;


                if (!this.allowed_file_name_extensions.includes(path.extname(uri.fsPath).toLowerCase())) { continue; }
                let existing_document = open_file_paths_map.get(path.normalize(uri.fsPath));

                if (!existing_document) {

                    tasks.push(this.handle_problems(uri));
                } else {
                    tasks.push(this.handle_problems(existing_document.uri));
                }
                await utils.sleep(10);
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

    };






    scan_for_all_undefined_keys = async (...args: any[]) => {


        await this.data.load_all();
        // const file_glob = new glob.Glob(`A3A/**/*.{${this.allowed_file_name_extensions.map((v) => v.replace(/^\./gm, "")).join(",")}}`, { absolute: true, cwd: utils.get_base_workspace_folder()?.uri.fsPath });
        const all_file_uris = (await vscode.workspace.findFiles(`A3A/**/*.{${this.allowed_file_name_extensions.map((v) => v.replace(/^\./gm, "")).join(",")}}`))
            .sort((a, b) => a.fsPath.toLowerCase().localeCompare(b.fsPath.toLowerCase()));
        // .filter((value) => fs.statSync(value.fsPath).size <= (250 * 1000));
        // .sort((a, b) => fs.statSync(b.fsPath).size - fs.statSync(a.fsPath).size);
        // .sort(() => randomInt(0, 1) - 0.5);
        const tasks: Promise<any>[] = [];
        let file_no = 0;

        const _all_undefined_keys: FoundKey[] = [];
        await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "finished scanning", cancellable: true },
            async (progress, token) => {
                progress.report({ message: "searching for files..." });
                for (const uri of all_file_uris) {

                    if (token.isCancellationRequested) { break; }

                    tasks.push(
                        this.handle_problems(uri, false)
                            .then((_undefined_keys) => {

                                if (_undefined_keys) {
                                    _all_undefined_keys.push(..._undefined_keys);
                                }
                                file_no += 1;

                                progress.report(
                                    { increment: 100 / all_file_uris.length, message: `\n${file_no}/${all_file_uris.length}\n${vscode.workspace.asRelativePath(uri, false)}` }

                                );

                            },
                                (reason) => console.log(`rejected reason: ${reason}`))

                    );

                    await utils.sleep(0);


                };

                if (!token.isCancellationRequested) {
                    await utils.sleep(100);
                    await Promise.all(tasks);
                    await utils.sleep(100);
                    create_undefined_stringtable_keys_result_web_view(_all_undefined_keys);
                    await utils.sleep(2 * 100);

                };

            });



    };

    public async register (context: vscode.ExtensionContext): Promise<vscode.Disposable[]> {
        const disposables: vscode.Disposable[] = [];


        disposables.push(vscode.languages.registerDefinitionProvider(this.file_selectors, this));
        disposables.push(vscode.languages.registerHoverProvider(this.file_selectors, this));

        disposables.push(vscode.workspace.onDidChangeConfiguration(this.handle_on_config_changed));

        disposables.push(vscode.workspace.onDidSaveTextDocument(this.handle_on_text_document_saved));
        disposables.push(vscode.workspace.onDidOpenTextDocument(this.handle_on_text_document_open));
        disposables.push(vscode.workspace.onDidChangeTextDocument(this.handle_on_did_change_document));

        disposables.push(vscode.workspace.onDidCloseTextDocument(this.handle_on_text_document_closed));
        disposables.push(vscode.commands.registerCommand('antistasi.scan-for-all-undefined-stringtable-keys', this.scan_for_all_undefined_keys, this));

        disposables.push(vscode.languages.registerCodeActionsProvider(this.file_selectors, this, this));
        disposables.push(vscode.languages.registerCompletionItemProvider(this.file_selectors, this));







        return disposables;
    };


    get [Symbol.toStringTag] () {

        return this.constructor.name;
    };

};;;