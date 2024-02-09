

const fs = require("fs-extra");
const path = require("path");
const { argv,cwd, env } = require("process");
const { minimatch } = require('minimatch');


const DB_FILE = path.resolve(__dirname, "builtin_arma_stringtable_data.db");

const DB_SQL_FILE = path.resolve(__dirname, "create_db.sql");


function get_out_folder() {

    const package_json = JSON.parse(fs.readFileSync("./package.json"));

    const raw_out_folder = package_json.main;


    return path.resolve(path.dirname(raw_out_folder));
}


function get_src_folder() {
    const tsconfig_json = JSON.parse(fs.readFileSync("./tsconfig.json"));

    const raw_src_folder = tsconfig_json.compilerOptions.rootDir;

    return path.resolve(path.join(__dirname,"..",raw_src_folder));
}


function clean_out_folder(out_folder) {
    if (!fs.existsSync(out_folder)) { return; };

    fs.removeSync(out_folder);
}


const TS_EXT_NAMES = [".ts", ".tsx"].map((item) => item.toLowerCase());




function* get_all_non_ts_files(base_folder) {

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

    for (const item of fs.readdirSync(base_folder, { recursive: true, withFileTypes: true })) {
        if (_is_non_ts_file(item)) {
            yield path.resolve(item.path,item.name);
        }
    }
}


function _copy_file(in_file_path, target_file_path) {
    fs.mkdirSync(path.dirname(target_file_path), { recursive: true });
    fs.copyFile(in_file_path, target_file_path);

    console.log(`copied`);
    console.log(`    '${in_file_path}'`);
    console.log(`        to`);
    console.log(`    '${target_file_path}'`);
    console.log(`${'-'.repeat(Math.max(in_file_path.length, target_file_path.length)+8)}`);
}


function copy_all_non_ts_files(src_folder, out_folder) {

    function _determine_new_path(_in_file_path,_src_folder, _out_folder) {
        const src_replace_regex = new RegExp("^" + _src_folder.replace(/\\/g, "\\\\"), "im");
        return path.resolve(path.join(_out_folder, _in_file_path.replace(src_replace_regex, "")));

    }

    for (const file_path of get_all_non_ts_files(src_folder)) {
        const new_file_path = _determine_new_path(file_path, src_folder, out_folder);
        _copy_file(file_path, new_file_path);
    }
}

function setup_out_folder(src_folder,out_folder) {

    copy_all_non_ts_files(src_folder, out_folder);

    // fs.mkdirSync(out_folder, { recursive: true })
    // fs.mkdirSync(path.join(out_folder, "sub_extensions", "stringtable_data"), { recursive: true });

    // fs.copyFile(DB_FILE, path.join(out_folder, "sub_extensions", "stringtable_data", path.basename(DB_FILE)))
    // fs.copyFile(DB_SQL_FILE, path.join(out_folder, "sub_extensions", "stringtable_data", path.basename(DB_SQL_FILE)));

};



const FILES_TO_IGNORE = ["**/snippets/sqf.json"];


const SRC_FOLDER = get_src_folder();
const OUT_FOLDER = get_out_folder();


clean_out_folder(OUT_FOLDER);
setup_out_folder(SRC_FOLDER,OUT_FOLDER);