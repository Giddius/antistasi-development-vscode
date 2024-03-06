
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as utils from "#utilities";
import { StringTableDataStorage, StringtableData, StringtableFileData, StringtableBuiltinData, StringtableEntry } from "./storage";
import { randomInt, randomUUID } from "crypto";


import { StringtableDataLoadedEvent } from "typings/general";
import AsyncLock from "async-lock";


import { create_undefined_stringtable_keys_result_web_view } from "../../web_views/undefined_stringtable_keys_view";
import { promises } from "fs-extra";

import { FoundKey, find_all_stringtable_keys, STRINGTABLE_KEY_PATTERN } from "./parsing";


import { StringTableTreeView } from "./tree_view";
import { profile, profileEnd } from "console";

// endregion[Imports]






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
    protected tree_view: StringTableTreeView;
    readonly providedCodeActionKinds: vscode.CodeActionKind[] = [vscode.CodeActionKind.QuickFix];
    private readonly problem_handling_lock: AsyncLock;
    private scan_for_all_undefined_keys_command_is_running: boolean;
    _key_icon?: vscode.ThemeIcon;

    constructor (stringtable_data: StringTableDataStorage) {
        this.config = this.load_config();
        this.data = stringtable_data;
        this.diagnostic_collection = vscode.languages.createDiagnosticCollection("antistasi-development");
        this.problems_handling_timeouts = new Map<vscode.Uri, NodeJS.Timeout>();
        this.problem_handling_lock = new AsyncLock();
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


    async handle_problems (file: vscode.Uri, recurring: boolean = true, token?: vscode.CancellationToken): Promise<FoundKey[] | undefined> {

        // const stringtable_clean_pattern = /(^"?\$?)(.*?)("?$)/g;
        const locked_res = await this.problem_handling_lock.acquire(path.normalize(file.fsPath), async () => {
            if ((!this._check_problems_handling_enabled())) {
                this.diagnostic_collection.delete(file);
                return;
            };
            // console.timeLog("handle_problems", vscode.workspace.asRelativePath(file));

            // async function* get_all_matches (in_line: string, in_line_number: number) {


            //     function clean_text (in_text: string): string {
            //         return in_text.trim().replace(stringtable_clean_pattern, `$2`);
            //     };



            //     // const regex = ([".hpp", ".cpp", ".ext", ".inc"].includes(path.extname(file!.fsPath))) ? cfg_regex : sqf_regex;

            //     for (const match of in_line.matchAll(STRINGTABLE_KEY_PATTERN)) {
            //         if (match[0].endsWith("+")) { continue; };
            //         yield new FoundKey(clean_text(match[0]), in_line_number, match.indices![0][0], match.indices![0][1], file.fsPath);
            //         await utils.sleep(1);
            //     };


            // };

            let inside_comment: boolean = false;


            const keys_to_ignore = this._get_stringtable_keys_to_ignore();

            const undefined_keys_severity = this.undefined_keys_problem_severity;




            const diagnostic_items = new Array<vscode.Diagnostic>();

            const all_undefined_keys: FoundKey[] = [];


            for await (const found_key of find_all_stringtable_keys(file)) {

                if (found_key.text.endsWith("_")) { continue; }
                this.data.add_usage_location(found_key);
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
                await utils.sleep(1);
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

            await utils.sleep(25);
            return all_undefined_keys;
        }, { maxPending: 2 });

        return locked_res;
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
        if (this.scan_for_all_undefined_keys_command_is_running) { vscode.window.showInformationMessage(`command is already running!`); return; }

        this.scan_for_all_undefined_keys_command_is_running = true;
        try {
            if (((Date.now() / 1000) - this.data.last_reloaded_at) >= (60 * 5)) {
                console.log(`reloading Data`);
                await this.data.load_all();
            }

            await utils.sleep(0.1 * 1000);
            const all_file_uris = (await vscode.workspace.findFiles(`A3A/**/*.{${this.allowed_file_name_extensions.map((v) => v.replace(/^\./gm, "")).join(",")}}`))
                .sort((a, b) => a.fsPath.toLowerCase().localeCompare(b.fsPath.toLowerCase())).reverse();
            // .filter((value) => fs.statSync(value.fsPath).size <= (250 * 1000));
            // .sort((a, b) => fs.statSync(b.fsPath).size - fs.statSync(a.fsPath).size);
            // .sort(() => randomInt(0, 1) - 0.5);

            let file_no = 0;

            let was_cancelled: boolean = false;

            const _all_undefined_keys: FoundKey[] = [];
            const tasks: Promise<any>[] = [];
            const start_time = Date.now();

            if (hide_progress_bar) {
                for (const uri of all_file_uris) {
                    tasks.push(
                        this.handle_problems(uri, false)
                            .then((_undefined_keys) => {

                                if ((_undefined_keys) && (show_summary_afterwards)) {
                                    _all_undefined_keys.push(..._undefined_keys);
                                }


                            }));
                    await utils.sleep(0);


                }
                await Promise.all(tasks);
            } else {

                await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: "finished scanning", cancellable: true },
                    async (progress, token) => {



                        progress.report({ message: "searching for files..." });
                        await utils.sleep(0.5 * 1000);
                        await utils.sleep(0.5 * 1000);
                        await utils.sleep(0.5 * 1000);
                        await utils.sleep(0.5 * 1000);

                        for (const uri of all_file_uris) {
                            if (token.isCancellationRequested) { break; }
                            tasks.push(
                                this.handle_problems(uri, false, token)
                                    .then((_undefined_keys) => {

                                        if ((_undefined_keys) && (show_summary_afterwards)) {
                                            _all_undefined_keys.push(..._undefined_keys);
                                        }
                                        file_no += 1;

                                        progress.report(
                                            { increment: 100 / all_file_uris.length, message: `\n${file_no}/${all_file_uris.length}\n${vscode.workspace.asRelativePath(uri, false)}` }

                                        );

                                    },
                                        (reason) => console.log(`rejected reason: ${reason}`))

                            );

                            // if (tasks.length >= 5) {
                            //     await utils.sleep(10);
                            //     await Promise.all(tasks.splice(0, tasks.length));
                            //     await utils.sleep(10);

                            // }
                            // if ((slow_down)) {
                            //     await utils.sleep(slow_down);
                            // }
                            // await utils.sleep(slow_down || 0);
                            await utils.sleep(0);



                        };
                        await utils.sleep(0.5 * 1000);


                        if (token.isCancellationRequested) {
                            was_cancelled = true;
                        };

                        await utils.sleep(0.5 * 1000);

                        const result = await Promise.all(tasks);
                        await utils.sleep(1.0 * 1000);
                        return result;

                    });
            }

            const end_time = Date.now();

            const duration = (end_time - start_time) / 1000;

            console.log(`scan_for_all_undefined_keys took ${duration}s`);
            vscode.window.showInformationMessage(`scan_for_all_undefined_keys took ${duration}s`);
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
        disposables.push(vscode.commands.registerCommand('antistasi.only-scan-for-all-undefined-stringtable-keys', (...args) => this.scan_for_all_undefined_keys(false), this));

        await vscode.commands.executeCommand('setContext', "antistasiDevelopment.commandEnabled.scan-for-all-undefined-stringtable-keys", true);

        disposables.push(vscode.languages.registerCodeActionsProvider(this.file_selectors, this, this));
        disposables.push(vscode.languages.registerCompletionItemProvider(this.file_selectors, this));

        await this.tree_view.register(context);



        utils.sleep(5.5 * 1000).then(() => this.scan_for_all_undefined_keys(false, 1, true)).then(() => console.log("scanned done"));

        return disposables;
    };


    get [Symbol.toStringTag] () {

        return this.constructor.name;
    };

};