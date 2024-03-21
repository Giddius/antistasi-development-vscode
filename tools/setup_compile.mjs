

// import * as fs from "fs";
import fs from 'fs-extra';

import * as path from "path";
import { minimatch } from "minimatch";
import { fileURLToPath } from 'url';





const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.resolve(__dirname, "builtin_arma_stringtable_data.db");

const DB_SQL_FILE = path.resolve(__dirname, "create_db.sql");

// const FILES_TO_IGNORE = ["**/snippets/sqf.json"];
const FILES_TO_IGNORE = [];


// const CWD = path.resolve(process.argv.at(2));
const CWD = __dirname;




async function escalating_find_file(file_name, base_dir = null, level = 1) {
    if (level >= 5) {
        return;
    }

    base_dir = base_dir || process.cwd();

    for await (const item of await fs.promises.readdir(base_dir, { withFileTypes: true })) {
        if (!item.isFile()) { continue; }
        if (item.name.toLocaleLowerCase() === file_name.toLocaleLowerCase()) {
            return path.join(item.path, item.name);
        };
    };
    return await escalating_find_file(file_name, path.resolve(base_dir, "../"), level + 1);
};

async function get_out_folder() {
    const package_json_file = await escalating_find_file("package.json", CWD);

    console.log(`package_json_file: ${package_json_file}`);

    const package_json = JSON.parse(await fs.promises.readFile(package_json_file));

    const raw_out_folder = package_json.main;


    return path.resolve(path.dirname(path.join(path.dirname(package_json_file), raw_out_folder)));
}


async function get_src_folder() {
    const tsconfig_json_file = await escalating_find_file("tsconfig.json", CWD);
    console.log(`tsconfig_json_file: ${tsconfig_json_file}`);

    const tsconfig_json = JSON.parse(await fs.promises.readFile(tsconfig_json_file));

    const raw_src_folder = tsconfig_json.compilerOptions.rootDir;

    return path.resolve(path.join(path.dirname(tsconfig_json_file), raw_src_folder));
}


async function clean_out_folder(out_folder) {
    if (!(fs.existsSync(out_folder))) { return; };

    await fs.promises.rm(out_folder, { recursive: true });
}


const TS_EXT_NAMES = [".ts", ".tsx"].map((item) => item.toLowerCase());




async function* get_all_non_ts_files(base_folder) {

    function _is_non_ts_file(in_item) {
        if (!in_item.isFile()) {
            return false;
        };

        const full_path = path.resolve(in_item.path, in_item.name);
        for (const ignore_pattern of FILES_TO_IGNORE) {
            if (minimatch(full_path, ignore_pattern)) {
                return false;
            };
        };
        const extension = path.extname(in_item.name).toLowerCase();

        return (!TS_EXT_NAMES.includes(extension));
    };

    for await (const item of await fs.promises.opendir(base_folder, { recursive: true, withFileTypes: true })) {
        if (_is_non_ts_file(item)) {
            yield path.resolve(item.path, item.name);
        }
    }
}


async function _copy_file(in_file_path, target_file_path) {
    await fs.promises.mkdir(path.dirname(target_file_path), { recursive: true });
    await fs.promises.copyFile(in_file_path, target_file_path);

    console.log(`copied`);
    console.log(`    '${in_file_path}'`);
    console.log(`        to`);
    console.log(`    '${target_file_path}'`);
    console.log(`${'-'.repeat(Math.max(in_file_path.length, target_file_path.length) + 8)}`);
}


async function copy_all_non_ts_files(src_folder, out_folder) {

    function _determine_new_path(_in_file_path, _src_folder, _out_folder) {
        const src_replace_regex = new RegExp("^" + _src_folder.replace(/\\/g, "\\\\"), "im");
        return path.resolve(path.join(_out_folder, _in_file_path.replace(src_replace_regex, "")));

    }
    const tasks = [];
    for await (const file_path of get_all_non_ts_files(src_folder)) {
        const new_file_path = _determine_new_path(file_path, src_folder, out_folder);
        tasks.push(_copy_file(file_path, new_file_path));
    }

    await Promise.all(tasks);
}

async function setup_out_folder(src_folder, out_folder) {

    await copy_all_non_ts_files(src_folder, out_folder);

    // fs.mkdirSync(out_folder, { recursive: true })
    // fs.mkdirSync(path.join(out_folder, "sub_extensions", "stringtable_data"), { recursive: true });

    // fs.copyFile(DB_FILE, path.join(out_folder, "sub_extensions", "stringtable_data", path.basename(DB_FILE)))
    // fs.copyFile(DB_SQL_FILE, path.join(out_folder, "sub_extensions", "stringtable_data", path.basename(DB_SQL_FILE)));

};


async function main() {

    const SRC_FOLDER = await get_src_folder();
    const OUT_FOLDER = await get_out_folder();


    await clean_out_folder(OUT_FOLDER);
    await setup_out_folder(SRC_FOLDER, OUT_FOLDER);
}


await main();


