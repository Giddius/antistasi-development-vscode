// region[Imports]

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs-extra";
import * as utils from "#utilities";
import { SubExtension } from "typings/general";

import { minimatch } from "minimatch";

// endregion[Imports]




export abstract class BaseSubExtension implements vscode.Disposable {
    static readonly __name__: string = "";
    static readonly __pretty_name__: string = "";

    static get __enabled__ (): boolean {
        return true;
    }

    static get __priority__ (): number {
        return 0;
    }

    // static get __name__ (): string {
    //     return this.constructor.name;
    // }

    // static get __pretty_name__ (): string {
    //     return utils.make_auto_pretty_name(this.__name__);
    // }


    public get __enabled__ (): boolean {
        return Object.getPrototypeOf(this).constructor.__enabled__;
    }

    public get __priority__ (): number {
        return Object.getPrototypeOf(this).constructor.__priority__;
    }

    public get __name__ (): string {
        return Object.getPrototypeOf(this).constructor.__name__;
    }

    public get __pretty_name__ (): string {
        return Object.getPrototypeOf(this).constructor.__pretty_name__;
    }





    public async register (context: vscode.ExtensionContext): Promise<void> { }
    public async dispose () { }

    get [Symbol.toStringTag] () {
        return `${this.constructor.name}()`;
    }

}

export abstract class AbstractCommand implements vscode.Disposable {
    protected config: vscode.WorkspaceConfiguration;

    constructor () {
        this.config = this.load_config();
    }



    abstract get config_key (): string;

    protected load_config (): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(this.config_key);
    }

    abstract get name (): string;

    get enabled (): boolean {
        return true;
    }
    protected abstract execute (...args: any[]): Promise<any | undefined>;

    protected show_command_disabled_message = async (): Promise<void> => {
        const text: string = `Command ${this.name} is disabled!`;
        await vscode.window.showInformationMessage(text, { modal: true });
    };

    public async call (...args: any[]) {
        if (this.enabled === false) {
            await this.show_command_disabled_message();
            return;
        }
        return await this.execute(...args);
    }
    protected async set_enablement_context (value: boolean): Promise<void> {
        const minimal_name = this.name.split(/\./gm).at(-1);
        await vscode.commands.executeCommand("setContext", `antistasiDevelopment.commandEnabled.${minimal_name}`, value);
    }

    public async register (context: vscode.ExtensionContext): Promise<void> {
        context.subscriptions.push(vscode.commands.registerCommand(this.name, this.call, this));
        await this.set_enablement_context(true);
    }

    public async dispose () {
        await this.set_enablement_context(false);
    }

    get [Symbol.toStringTag] () {
        return `${this.constructor.name}(${this.name})`;
    }
}

export abstract class SubExtensionCommand extends AbstractCommand {
    readonly sub_extension: SubExtension;

    constructor (sub_extension: SubExtension) {
        super();
        this.sub_extension = sub_extension;
    }
}

export abstract class FreeCommand extends AbstractCommand { }

export class ResourceFile {
    readonly path: string;

    constructor (file_path: string) {
        this.path = path.normalize(file_path);
    }

    public get name (): string {
        return path.basename(this.path);
    }

    public get dirname (): string {
        return path.dirname(this.path);
    }

    public get extension (): string {
        return path.extname(this.path);
    }

    async read_text (encoding: BufferEncoding = "utf-8"): Promise<string> {
        return await fs.readFile(this.path, encoding);
    }

    async *iter_lines (include_newline?: boolean): AsyncGenerator<vscode.TextLine> {
        yield* utils.iter_file_lines(this.path, include_newline);
    }
}

export class DirectoryResourceManager {
    readonly path: string;
    private readonly _resource_files: Map<string, ResourceFile>;
    private _resource_files_loaded: boolean = false;

    constructor (directory_path: string) {
        this.path = path.normalize(directory_path);
        this._resource_files = new Map();
    }

    join_path (...new_path_parts: string[]): string {
        return path.join(this.path, ...new_path_parts);
    }

    public get resource_files (): ReadonlyMap<string, ResourceFile> {
        return this._resource_files;
    }

    public get_resource (name: string) {
        return this._resource_files.get(name.toLowerCase());
    }

    load_resource_files (ignore?: string[]) {
        const to_ignore_files = ["*.js", "*.ts", "*.js.map"].concat(...(ignore || [])).map((pattern) => {
            return new minimatch.Minimatch(pattern, { matchBase: true });
        });

        const check_if_should_ignore = (in_file: string) => {
            for (const ignore_pattern of to_ignore_files) {
                if (ignore_pattern.match(in_file) === true) {
                    return true;
                }
            }
            return false;
        };

        for (const file_name of fs.readdirSync(this.path, { recursive: false, withFileTypes: false, encoding: "utf-8" })) {
            const file = this.join_path(file_name);

            if (check_if_should_ignore(file)) {
                continue;
            }

            const resource_file = new ResourceFile(file);

            this._resource_files.set(resource_file.name.toLowerCase(), resource_file);
        }
        this._resource_files_loaded = true;
        return this;
    }
}
