
// region[Imports]

import * as vscode from 'vscode';




import * as path from "path";


import * as fs from "fs";

import * as utilities from "../utilities";

import { StringTableDataStorage } from "./storage";


// endregion[Imports]



export class StringTableProvider implements vscode.Disposable, vscode.HoverProvider, vscode.DefinitionProvider {
    protected config: vscode.WorkspaceConfiguration;
    protected data: StringTableDataStorage;



    constructor(config: vscode.WorkspaceConfiguration) {
        this.config = config;
        this.data = new StringTableDataStorage();

    };



    on_config_changed = (event: vscode.ConfigurationChangeEvent) => {
        const root_workspace_folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.at(0);

        if (!event.affectsConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder)) return;

        this.config = vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder);
        this.load_data();
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

    async get_word(document: vscode.TextDocument, range: vscode.Range): Promise<string> {


        let curr_word = document.getText(range).toLowerCase();


        if ((document.languageId === "ext") || (document.languageId === "cpp")) {

            curr_word = curr_word.replace(/^\$/gm, "")

        };


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

    async load_data(): Promise<void> {
        await this.data.load_data();
    };


    static get hover_selectors(): ReadonlyArray<vscode.DocumentFilter> {
        const selectors = new Array<vscode.DocumentFilter>({ scheme: "file", language: "cpp" });

        let sqf_language_exists: boolean = false;

        vscode.languages.getLanguages().then((languages) => {
            if (languages.indexOf("sqf") !== -1) { sqf_language_exists = true; };
        });


        if (sqf_language_exists) {
            selectors.push({ scheme: "file", language: "sqf" });
            selectors.push({ scheme: "file", language: "ext" });
        } else {
            selectors.push({ scheme: "file", pattern: "**/*.sqf" });
            selectors.push({ scheme: "file", pattern: "**/*.ext" });

        };


        const out: ReadonlyArray<vscode.DocumentFilter> = Array.from(selectors);
        return out;
    };



    dispose() {
        this.data.clear();
    }
};





export async function activate_sub_extension(context: vscode.ExtensionContext): Promise<void> {


    const root_workspace_folder: vscode.WorkspaceFolder | undefined = vscode.workspace.workspaceFolders?.at(0);

    const config = vscode.workspace.getConfiguration("antistasiDevelopment.stringtable_data", root_workspace_folder);




    let STRINGTABLE_PROVIDER: StringTableProvider = new StringTableProvider(config);
    STRINGTABLE_PROVIDER.load_data();






    context.subscriptions.push(vscode.languages.registerHoverProvider(StringTableProvider.hover_selectors, STRINGTABLE_PROVIDER));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(StringTableProvider.hover_selectors, STRINGTABLE_PROVIDER));

    vscode.workspace.onDidChangeConfiguration(STRINGTABLE_PROVIDER.on_config_changed);

};



export async function deactivate_sub_extension() { };