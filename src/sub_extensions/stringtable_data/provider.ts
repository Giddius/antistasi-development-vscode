
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as utils from "#utilities";
import { StringTableDataStorage, StringtableData, StringtableFileData, StringtableBuiltinData, StringtableEntry } from "./storage";
import { randomInt, randomUUID, getHashes } from "crypto";
import * as fs from "fs-extra";


import { StringtableDataLoadedEvent } from "typings/general";
import AsyncLock from "async-lock";


import { create_undefined_stringtable_keys_result_web_view } from "../../web_views/undefined_stringtable_keys_view";

import { FoundKey, find_all_stringtable_keys, STRINGTABLE_KEY_PATTERN } from "./parsing";


import { StringTableTreeView } from "./tree_view";

// endregion[Imports]





export class StringTableProvider implements vscode.HoverProvider, vscode.DefinitionProvider, vscode.CodeActionProvider, vscode.CodeActionProviderMetadata {

    public readonly config_key: string = "antistasiDevelopment.stringtable_data";

    public readonly basic_allowed_file_name_extensions: string[] = [
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
    protected tree_view: StringTableTreeView;
    readonly providedCodeActionKinds: vscode.CodeActionKind[] = [vscode.CodeActionKind.QuickFix];

    private scan_for_all_undefined_keys_command_is_running: boolean;
    _key_icon?: vscode.ThemeIcon;

    constructor (stringtable_data: StringTableDataStorage) {
        this.config = this.load_config();
        this.data = stringtable_data;
        this.diagnostic_collection = vscode.languages.createDiagnosticCollection("antistasi-development");
        this.problems_handling_timeouts = new Map<vscode.Uri, NodeJS.Timeout>();

        this.scan_for_all_undefined_keys_command_is_running = false;
        this._key_icon = new vscode.ThemeIcon("key");
        this.tree_view = new StringTableTreeView(this.data);
    };



    public get key_icon (): vscode.ThemeIcon {
        if (!this._key_icon) {
            this._key_icon = new vscode.ThemeIcon("key");
        }

        return this._key_icon;
    }


    private get_extra_allowed_file_name_extensions (): string[] {
        return this.config.get("extraFileNameExtensions") as string[];
    };

    public get file_selectors (): vscode.DocumentSelector {

        return this.allowed_file_name_extensions.map((value) => { return { scheme: "file", pattern: "**/*" + value }; }) as vscode.DocumentSelector;

    }

    public get undefined_keys_problem_severity (): vscode.DiagnosticSeverity {
        const raw_severity: string = this.config.get("undefinedKeysProblemSeverity")!;

        switch (raw_severity.toUpperCase()) {
            case "HINT":
                return vscode.DiagnosticSeverity.Hint;

            case "INFO":
                return vscode.DiagnosticSeverity.Information;

            case "INFORMATION":
                return vscode.DiagnosticSeverity.Information;

            case "WARNING":
                return vscode.DiagnosticSeverity.Warning;

            case "ERROR":
                return vscode.DiagnosticSeverity.Error;

            default:
                return vscode.DiagnosticSeverity.Error;
        }


    };

    public get allowed_file_name_extensions (): string[] {
        return this.basic_allowed_file_name_extensions.concat(this.get_extra_allowed_file_name_extensions());
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
                if ((open_file_paths.includes(path.normalize(file.fsPath)))) {
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






    async handle_problems (file: vscode.Uri, recurring: boolean = true, token?: vscode.CancellationToken): Promise<FoundKey[] | undefined> {



        if ((!this._check_problems_handling_enabled())) {
            this.diagnostic_collection.delete(file);
            return;
        };



        const keys_to_ignore = this._get_stringtable_keys_to_ignore();

        const undefined_keys_severity = this.undefined_keys_problem_severity;




        const diagnostic_items = new Array<vscode.Diagnostic>();

        const all_undefined_keys: FoundKey[] = [];

        const all_found_keys: Array<FoundKey> = [];

        for await (const found_key of find_all_stringtable_keys(file)) {
            this.data.add_usage_location(found_key);
            if (found_key.text.endsWith("_")) { continue; }


            if (([".hpp", ".cpp", ".ext", ".inc"].includes(path.extname(file.fsPath))) && (found_key.text.startsWith("str_"))) {
                const not_upper_case_diagnostic_item = new vscode.Diagnostic(found_key.range, "stringtable keys in '.hpp', '.cpp', '.ext' or '.inc' files, need to start with upper case 'STR_' ", vscode.DiagnosticSeverity.Error);
                not_upper_case_diagnostic_item.source = "antistasi-development";
                diagnostic_items.push(not_upper_case_diagnostic_item);
            };

            if ((!keys_to_ignore.includes(found_key.text.toLowerCase())) && (!await this.data.get_entry(found_key.text, file.fsPath))) {
                const data_item = await this.data.get_data_item_for_file(file);
                const message_text = `'${found_key.text}' undefined` + ((data_item?.is_parseable === false) ? `\n('${vscode.workspace.asRelativePath(data_item.file_path)}' is not parseable)` : "");

                const diagnostic_item = new vscode.Diagnostic(found_key.range, message_text, undefined_keys_severity);
                diagnostic_item.source = "antistasi-development";
                if (data_item) {
                    diagnostic_item.code = { value: `Stringtable(${data_item.name})`, target: data_item.uri };
                };
                diagnostic_items.push(diagnostic_item);
                all_undefined_keys.push(found_key);
            }


        };






        // };
        this.diagnostic_collection.delete(file);
        this.diagnostic_collection.set(file, diagnostic_items);

        if ((recurring) && (vscode.workspace.textDocuments.map((item) => path.normalize(item.uri.fsPath)).includes(path.normalize(file.fsPath)))) {
            let timeout = this.problems_handling_timeouts.get(file);

            if (timeout) {
                clearTimeout(timeout);
                this.problems_handling_timeouts.delete(file);
            };
            timeout = setTimeout(async () => { this.handle_problems(file, true); }, (25 * 1000) + randomInt(0, 5000));
            this.problems_handling_timeouts.set(file, timeout);


        };

        await utils.sleep(5);
        return all_undefined_keys;

    }



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
        for (const timeout of this.problems_handling_timeouts.values()) {
            clearTimeout(timeout);
        };
        this.problems_handling_timeouts.clear();


    };





    async scan_for_all_undefined_keys (show_summary_afterwards: boolean, slow_down?: number, hide_progress_bar?: boolean, ...args: any[]) {
        if (this.scan_for_all_undefined_keys_command_is_running) {
            vscode.window.showInformationMessage(`command is already running!`); return;
        }

        const start_time = Date.now();

        this.scan_for_all_undefined_keys_command_is_running = true;
        try {



            await utils.sleep(0.1 * 1000);
            const exclude_pattern = utils.convert_to_case_insensitive_glob_pattern(`**/navgrid`);
            const all_file_uris = (await vscode.workspace.findFiles(`**/*.{${this.allowed_file_name_extensions.map((v) => v.replace(/^\./gm, "")).join(",")}}`, `${exclude_pattern}.sqf`))
                .sort((a, b) => { return utils.sort_file_paths(a.fsPath, b.fsPath); });


            const all_hashes = await Promise.all(all_file_uris.map(async (item_uri) => { return [item_uri, await utils.file_hash(item_uri.fsPath, { algorithm: "md5" })]; }));

            const max_file_amount = all_file_uris.length;
            let file_no = 0;

            let was_cancelled: boolean = false;

            const _all_undefined_keys: FoundKey[] = [];
            const tasks: Promise<any>[] = [];

            const do_handle = async (_uri: vscode.Uri, _progress: vscode.Progress<{ message?: string | undefined; increment?: number | undefined; }>, _token: vscode.CancellationToken) => {
                if (_token.isCancellationRequested) {
                    return;
                }


                const result_keys = await this.handle_problems(_uri, false, _token);
                if ((result_keys) && (show_summary_afterwards)) {
                    _all_undefined_keys.push(...result_keys);
                }
                file_no += 1;
                const path_text = vscode.workspace.asRelativePath(_uri, false);
                _progress.report(
                    (hide_progress_bar) ? { increment: 100 / max_file_amount, message: `${file_no}/${max_file_amount}: ${path_text}` } : { increment: 100 / max_file_amount, message: `\n${file_no}/${max_file_amount}\n${path_text}` }

                );

            };

            await vscode.window.withProgress<FoundKey[][]>({ location: (hide_progress_bar) ? vscode.ProgressLocation.Window : vscode.ProgressLocation.Notification, title: "", cancellable: (hide_progress_bar) ? false : true },
                async (progress, token) => {


                    progress.report({ message: "searching for files..." });



                    for (const uri of all_file_uris) {


                        if (token.isCancellationRequested) { break; }
                        tasks.push(do_handle(uri, progress, token));
                        // await do_handle(uri, progress, token);



                        await utils.sleep(randomInt(0, 1));





                    };
                    // await utils.sleep(0.25 * 1000);


                    if (token.isCancellationRequested) {
                        was_cancelled = true;
                    };


                    const result = await Promise.all(tasks);
                    return result;

                });




            const end_time = Date.now();

            const duration = (end_time - start_time) / 1000;
            const duration_per_file = utils.better_round(duration / max_file_amount, 3);

            console.log(`scan_for_all_undefined_keys took ${duration}s`);
            console.log(`per file: ${duration_per_file}s`);
            if ((!was_cancelled) && (show_summary_afterwards)) {
                await create_undefined_stringtable_keys_result_web_view(_all_undefined_keys);
                await utils.sleep(2 * 100);
            }

            return;
        } finally {
            this.scan_for_all_undefined_keys_command_is_running = false;
        }
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
        disposables.push(vscode.commands.registerCommand('antistasi.scan-for-all-undefined-stringtable-keys', (...args) => this.scan_for_all_undefined_keys(true), this));
        disposables.push(vscode.commands.registerCommand('antistasi.only-scan-for-all-undefined-stringtable-keys', (...args) => this.scan_for_all_undefined_keys(false, undefined, true), this));

        await vscode.commands.executeCommand('setContext', "antistasiDevelopment.commandEnabled.scan-for-all-undefined-stringtable-keys", true);

        disposables.push(vscode.languages.registerCodeActionsProvider(this.file_selectors, this, this));


        await this.tree_view.register(context);



        utils.sleep(5.5 * 1000).then(() => this.scan_for_all_undefined_keys(false, 1, true)).then(() => console.log("scanned done"));

        return disposables;
    };


    get [Symbol.toStringTag] () {

        return this.constructor.name;
    };

};