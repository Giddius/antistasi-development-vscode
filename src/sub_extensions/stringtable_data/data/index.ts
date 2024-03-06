import * as path from "path";
import { fileURLToPath } from 'url';

import { ResourceFile, DirectoryResourceManager } from "#bases";


const AvailableData = new DirectoryResourceManager(__dirname);

AvailableData.load_resource_files();


export default AvailableData;