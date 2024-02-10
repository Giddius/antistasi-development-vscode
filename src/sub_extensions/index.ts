
// region[Imports]

import * as vscode from 'vscode';
import * as stringtable_data from "./stringtable_data";
import { SubExtension } from "typings/general";
import * as utils from "#utilities";

// endregion[Imports]

function _fill_sub_extension_default_values (sub_extension: any): SubExtension {

    sub_extension.__enabled__ = sub_extension.__enabled__ || true;

    sub_extension.__pretty_name__ = sub_extension.__pretty_name__ || utils.make_auto_pretty_name(sub_extension.__name__);

    sub_extension.__priority__ = sub_extension.__priority__ || 0;

    return sub_extension;
};


function _handle_all_subextensions (raw_sub_extensions: any[]): ReadonlyArray<SubExtension> {
    return raw_sub_extensions.map(_fill_sub_extension_default_values).sort((a, b) => a.__priority__ - b.__priority__);
};


export const ALL_SUB_EXTENSIONS: ReadonlyArray<SubExtension> = _handle_all_subextensions(
    [
        stringtable_data
    ]
);

export const ALL_ENABLED_SUB_EXTENSIONS: ReadonlyArray<SubExtension> = ALL_SUB_EXTENSIONS.filter((sub_extension) => sub_extension.__enabled__);




export function activate_all_sub_extensions (context: vscode.ExtensionContext) {


    return Promise.allSettled(ALL_ENABLED_SUB_EXTENSIONS.map((sub_extension) => { return sub_extension.activate_sub_extension(context); }));

};




export function deactivate_all_sub_extensions () {
    return Promise.allSettled(ALL_ENABLED_SUB_EXTENSIONS.map((sub_extension) => { return sub_extension.deactivate_sub_extension!(); }));
};