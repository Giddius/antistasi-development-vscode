
// region[Imports]

import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs-extra";
import * as utils from "#utilities";
import * as general_typings from "typings/general";

import * as node_utils from "util";
// endregion[Imports]



interface LoggingLevelValue {
    name: string,
    value: number;

}

enum LoggingLevel {
    ALL,
    DEBUG,
    INFO,
    WARNING,
    ERROR,
    NO_LEVEL = Infinity,
};




export interface Logger {


    debug (msg: string): void;
    info (msg: string): void;
    warn (msg: string): void;
    error (msg: string): void;


    set_logging_level (level: LoggingLevelValue): void;

};



