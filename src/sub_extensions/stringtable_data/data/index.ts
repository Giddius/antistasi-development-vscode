// region[Imports]



import { ResourceFile, DirectoryResourceManager } from "#bases";

// endregion[Imports]


const AvailableData = new DirectoryResourceManager(__dirname);

AvailableData.load_resource_files();


export default AvailableData;